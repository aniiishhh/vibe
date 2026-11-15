"""Read-only IAM adapter. Authorized SameClass clients pinned at 3292dea.
No upstream LICENSE file was present; user authorization is not a general redistribution license.
See UPSTREAM_SOURCE_NOTES.md for original Class_Helper and ClassCue attribution.
"""
import sys
import re
from urllib.parse import urlencode
from pathlib import Path
from datetime import datetime, timezone
sys.path.insert(0, str(Path(__file__).parent/'vendor'))
from class_search_api.api import ASUClassSearchClient
from class_search_api.normalize import normalize_section, section_url
from class_search_api.syllabus import lookup_syllabus, prior_terms
from class_search_api.transport import SourceError
from rmp_api.rmp import RateMyProfessorsAPI
from requests.adapters import HTTPAdapter

def class_search_params(args):
    aliases={'instructor':'instructorName','days':'daysOfWeek','start_date':'startDate','end_date':'endDate'}
    keys=('term','subject','catalog_nbr','keywords','instructor','campus','campus_or_online_selection','location','session','days','start_date','end_date','units','college','search_type','honors','promod')
    params={aliases.get(k,k):args[k] for k in keys if args.get(k) not in (None,'')}
    if args.get('level'):
        level=args['level']
        if type(level) is not int or level not in range(100,1000,100): raise ValueError('Invalid course level')
        params['level']='grad' if level>=500 else 'undergrad'
    return params

def matching_sections(raw, args):
    sections=[normalize_section(row,args['term']) for row in raw['classes']]
    return [row for row in sections if
        (not args.get('subject') or row['subject']==args['subject']) and
        (not args.get('catalog_nbr') or str(row['catalog_nbr'])==args['catalog_nbr']) and
        (not args.get('level') or re.fullmatch(str(args['level']//100)+r'\d{2}[A-Z]?',str(row['catalog_nbr'])))]

def search_source_url(args):
    params=class_search_params(args)
    aliases={'catalog_nbr':'catalogNbr','search_type':'searchType','campus_or_online_selection':'campusOrOnlineSelection'}
    return 'https://catalog.apps.asu.edu/catalog/classes/classlist?'+urlencode({aliases.get(k,k):v for k,v in params.items()})

def professor_review_evidence(professor, sample, course=None):
    normalize = lambda value: re.sub(r'[^A-Z0-9]', '', str(value).upper())
    requested = normalize(course) if course else None
    rows = sample.get('reviews', [])
    matching = [row for row in rows if requested and normalize(row.get('class','')) == requested]
    chosen = matching if matching else rows
    reviews = [{k:row.get(k) for k in ('class','date','helpfulRating','clarityRating','difficultyRating','ratingTags','wouldTakeAgain')}
        | {'comment':str(row.get('comment') or '')[:600]} for row in chosen[:10]]
    def average(key):
        values=[row.get(key) for row in matching if type(row.get(key)) in (int,float) and 1<=row[key]<=5]
        return round(sum(values)/len(values),2) if values else None
    course_metrics={'sample_count':len(matching),'average_helpfulness':average('helpfulRating'),
        'average_clarity':average('clarityRating'),'average_difficulty':average('difficultyRating'),
        'scope':'retrieved requested-course sample only'} if requested else None
    return {'professor':professor, 'requested_course':course,'course_sample_metrics':course_metrics,
        'returned_review_count':len(reviews),'next_cursor':sample.get('pageInfo',{}).get('endCursor') if not sample.get('complete') else None, 'course_review_count_in_sample':len(matching),
        'review_scope':'requested_course' if matching else 'other_or_unspecified_courses' if requested else 'all_courses',
        'sampled_review_count':len(rows),'reviews':reviews,
        'complete':sample.get('complete',False) and not sample.get('start_cursor') and len(chosen)<=10,
        'source_pages_exhausted':sample.get('complete',False),'start_cursor':sample.get('start_cursor',''),
        'stop_reason':sample.get('stop_reason'),'source_url':professor.get('profile_url'),
        'note':'Professor metrics aggregate all courses. Missing course-specific reviews in this bounded sample do not establish that none exist. Reviews are subjective.'}

def handler(event, context=None):
    tool, args = event.get('tool'), event.get('input', {})
    if tool not in {'discover_courses','search_classes','get_course_details','get_syllabus_evidence','find_professors','get_professor_reviews'}:
        return {'status':'error','error':'Unknown tool'}
    cls = ASUClassSearchClient if tool in {'discover_courses','search_classes','get_course_details','get_syllabus_evidence'} else RateMyProfessorsAPI
    c = cls(timeout=(3,8))
    c.session.mount('https://', HTTPAdapter(max_retries=0))
    try:
        if tool == 'discover_courses':
            level = args['level']
            if type(level) is not int or level not in range(100, 1000, 100):
                raise ValueError('Invalid course level')
            raw = c.search_all_classes(**class_search_params(args), max_pages=2)
            courses = {}
            for section in matching_sections(raw,args):
                code = f"{section['subject']} {section['catalog_nbr']}"
                course = courses.setdefault(code, {'course':code,'title':section['title'],'sections':[]})
                if len(course['sections']) < 2:
                    course['sections'].append({k:section[k] for k in ['class_nbr','instructors','meeting_intervals','timezone','class_url','open_seats']})
            result = {'courses':list(courses.values())[:8], 'complete':raw['complete'] and len(courses)<=8,
                'stop_reason':raw['stop_reason'],'level':level,'section_sample_limit':2,
                'source_url':search_source_url(args),'query_filters':args}
        elif tool == 'search_classes':
            raw = c.search_all_classes(**class_search_params(args), max_pages=2)
            sections=matching_sections(raw,args)
            result = {'sections':sections[:5], 'complete':raw['complete'] and len(sections)<=5,'stop_reason':raw['stop_reason'],'query_filters':args,'source_url':search_source_url(args)}
        elif tool == 'get_course_details':
            result = {'courses':c.get_courses(**args)[:5], 'source_url':section_url(**args)}
        elif tool == 'get_syllabus_evidence':
            common = {k:args[k] for k in ('term','subject','catalog_nbr')}
            result = lookup_syllabus(c, **common, professor=args.get('professor',''), fallback_terms=args.get('fallback_terms',prior_terms(args['term'],6)), max_pages=1, max_chars=6000, budget_seconds=60)
            result.pop('download_url',None)
            result['source_url'] = section_url(result.get('source_term') or args['term'],args['subject'],args['catalog_nbr'])
            result['requested_source_url']=section_url(**common)
            if 'pages' in result: result.pop('text',None)  # Pages already contain the same bounded text.
            result['fallback_order']='requested-term/same-professor, prior-terms/same-professor, then different professors'
        elif tool == 'find_professors':
            schools = [s for s in c.search_school('Arizona State University') if s.get('name','').lower() == 'arizona state university' and s.get('city','').lower() == args.get('city','Tempe').lower()]
            result = {**c.get_professors_page(schools[0]['id'], limit=5, search_text=args['name']), 'school':schools[0]} if len(schools)==1 else {'schools':schools,'warning':'Ambiguous school identity'}
        else:
            result = professor_review_evidence(c.get_professor(args['teacher_id']), c.collect_reviews(args['teacher_id'],page_size=10,max_pages=args.get('max_pages',2),cursor=args.get('cursor',''),budget_seconds=35), args.get('course'))
        return {'status':'ok','retrieved_at':datetime.now(timezone.utc).isoformat(),'data':result,'warning':'Bounded source sample. Verify professor identity, prerequisites and labs. Missing meetings remain unknown; reviews are subjective.'}
    except SourceError as exc:
        return {'status':'error','source':exc.service,'upstream_status':exc.upstream_status,'retry_after':exc.retry_after,'error':str(exc)}
    except (ValueError,KeyError,TypeError):
        return {'status':'error','error':'Invalid research input'}
    finally:
        c.close()
