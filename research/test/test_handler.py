import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import handler as adapter
from class_search_api.transport import SourceError

def test_unknown_tool_is_rejected():
    assert adapter.handler({'tool':'delete_account','input':{}})['status']=='error'

def test_source_failures_preserve_retry_metadata(monkeypatch):
    class Client:
        session=type('Session',(),{'mount':lambda *args:None})()
        def __init__(self,**kwargs): pass
        def search_all_classes(self,**kwargs): raise SourceError('ASU','Unavailable',upstream_status=429,retry_after='60')
        def close(self): pass
    monkeypatch.setattr(adapter,'ASUClassSearchClient',Client)
    result=adapter.handler({'tool':'search_classes','input':{'term':'2271','subject':'CSE','catalog_nbr':'511'}})
    assert result['upstream_status']==429 and result['retry_after']=='60'


def test_discovery_filters_level_and_deduplicates_courses(monkeypatch):
    class Client:
        session=type('Session',(),{'mount':lambda *args:None})()
        def __init__(self,**kwargs): pass
        def search_all_classes(self,**kwargs):
            assert kwargs['level']=='grad' and 'catalog_nbr' not in kwargs and kwargs['keywords']=='database'
            return {'classes':[{'id':1},{'id':2},{'id':3}], 'complete':True,'stop_reason':'exhausted'}
        def close(self): pass
    def normalize(row,term):
        return {'subject':'CSE','catalog_nbr':'412' if row['id']==3 else '511','title':'Retrieved course title',
            'class_nbr':str(row['id']),'instructors':[],'meeting_intervals':[], 'timezone':'America/Phoenix','class_url':'https://example.com','open_seats':1}
    monkeypatch.setattr(adapter,'ASUClassSearchClient',Client)
    monkeypatch.setattr(adapter,'normalize_section',normalize)
    result=adapter.handler({'tool':'discover_courses','input':{'term':'2271','subject':'CSE','level':500,'keywords':'database'}})['data']
    assert len(result['courses'])==1 and result['courses'][0]['course']=='CSE 511'
    assert len(result['courses'][0]['sections'])==2


def test_reviews_prioritize_requested_course_and_keep_metrics_scope():
    result=adapter.professor_review_evidence({'profile_url':'https://www.ratemyprofessors.com/professor/123','numRatings':50},
        {'reviews':[{'class':'CSE475','comment':'Useful practical labs','date':'2026-01-01'},{'class':'CSE110','comment':'Different course'}], 'complete':False},'CSE 475')
    assert result['review_scope']=='requested_course' and result['course_review_count_in_sample']==1
    assert result['sampled_review_count']==2 and len(result['reviews'])==1
    assert result['reviews'][0]['comment']=='Useful practical labs'
    assert result['professor']['numRatings']==50 and result['complete'] is False


def test_missing_course_reviews_are_labelled_as_other_course_sample():
    result=adapter.professor_review_evidence({'profile_url':'https://example.com'},
        {'reviews':[{'class':'CSE110','comment':'x'*1500},{'class':'475','comment':'Department unspecified'}], 'complete':False},'CSE 475')
    assert result['review_scope']=='other_or_unspecified_courses' and result['course_review_count_in_sample']==0
    assert len(result['reviews'][0]['comment'])==600
    assert 'do not establish that none exist' in result['note']


def test_search_filters_map_to_upstream_wire_parameters_without_a_course_number(monkeypatch):
    class Client:
        session=type('Session',(),{'mount':lambda *args:None})()
        def __init__(self,**kwargs): pass
        def search_all_classes(self,**kwargs):
            assert kwargs=={'term':'2271','keywords':'robotics','instructorName':'Sample Professor','campus':'TEMPE','daysOfWeek':'MW','startDate':'2027-01-11','search_type':'open','max_pages':2}
            return {'classes':[],'complete':True,'stop_reason':'exhausted'}
        def close(self): pass
    monkeypatch.setattr(adapter,'ASUClassSearchClient',Client)
    result=adapter.handler({'tool':'search_classes','input':{'term':'2271','keywords':'robotics','instructor':'Sample Professor','campus':'TEMPE','days':'MW','start_date':'2027-01-11','search_type':'open'}})
    assert result['status']=='ok' and result['data']['sections']==[]
    assert 'instructorName=Sample+Professor' in result['data']['source_url']


def test_syllabus_wrapper_restores_automatic_history_and_preserves_actual_source(monkeypatch):
    class Client:
        session=type('Session',(),{'mount':lambda *args:None})()
        def __init__(self,**kwargs): pass
        def close(self): pass
    def lookup(client,**kwargs):
        assert kwargs['fallback_terms']==['2267','2264','2261','2257','2254','2251']
        return {'status':'ok','source_term':'2267','historical':True,'same_professor':False,'warning':'Different instructor',
            'download_url':'https://example.com/signed','text':'Duplicate text','pages':[{'page':1,'text':'Actual excerpt'}]}
    monkeypatch.setattr(adapter,'ASUClassSearchClient',Client)
    monkeypatch.setattr(adapter,'lookup_syllabus',lookup)
    result=adapter.handler({'tool':'get_syllabus_evidence','input':{'term':'2271','subject':'CSE','catalog_nbr':'511','professor':'Sample Professor'}})['data']
    assert result['historical'] and result['same_professor'] is False
    assert 'term=2267' in result['source_url'] and 'term=2271' in result['requested_source_url']
    assert 'download_url' not in result and 'text' not in result and result['pages'][0]['page']==1


def test_course_metrics_are_sample_only_and_cursor_is_preserved():
    result=adapter.professor_review_evidence({'numRatings':200},{'reviews':[
        {'class':'CSE475','helpfulRating':4,'clarityRating':2,'difficultyRating':5},
        {'class':'CSE475','helpfulRating':2,'clarityRating':4,'difficultyRating':3},
        {'class':'CSE110','helpfulRating':5}], 'complete':False,'pageInfo':{'endCursor':'next'}},'CSE 475')
    assert result['course_sample_metrics']['average_helpfulness']==3
    assert result['course_sample_metrics']['average_difficulty']==4
    assert result['course_sample_metrics']['sample_count']==2
    assert result['professor']['numRatings']==200 and result['next_cursor']=='next'


def test_actual_syllabus_history_ranks_same_professor_before_current_other(monkeypatch):
    import class_search_api.syllabus as syllabus
    class Client:
        session=type('Session',(),{'mount':lambda *args:None})()
        def __init__(self,**kwargs): pass
        def search_all_classes(self,**kwargs):
            term=kwargs['term']
            return {'classes':[{'CLAS':{'CLASSNBR':term,'STRM':term,'SUBJECT':'CSE','CATALOGNBR':'511','INSTRUCTORSLIST':['Other Professor' if term=='2271' else 'Sample Professor']},'HASSYLLABUS':True}], 'complete':True}
        def get_syllabus_url(self,number,term): return 'https://asu.edu/syllabus.txt'
        def close(self): pass
    monkeypatch.setattr(adapter,'ASUClassSearchClient',Client)
    monkeypatch.setattr(syllabus,'download_document',lambda *args:(b'Syllabus topics and grading evidence','text/plain','https://asu.edu/syllabus.txt'))
    result=adapter.handler({'tool':'get_syllabus_evidence','input':{'term':'2271','subject':'CSE','catalog_nbr':'511','professor':'Sample Professor'}})['data']
    assert result['source_term']=='2267' and result['same_professor'] is True and result['historical'] is True
    assert result['pages'][0]['text']=='Syllabus topics and grading evidence'
    assert 'Historical' in result['warning']


def test_actual_syllabus_other_professor_fallback_is_flagged(monkeypatch):
    import class_search_api.syllabus as syllabus
    class Client:
        session=type('Session',(),{'mount':lambda *args:None})()
        def __init__(self,**kwargs): pass
        def search_all_classes(self,**kwargs):
            term=kwargs['term']
            return {'classes':[{'CLAS':{'CLASSNBR':term,'STRM':term,'SUBJECT':'CSE','CATALOGNBR':'511','INSTRUCTORSLIST':['Other Professor']},'HASSYLLABUS':True}] if term=='2267' else [], 'complete':True}
        def get_syllabus_url(self,number,term): return 'https://asu.edu/syllabus.txt'
        def close(self): pass
    monkeypatch.setattr(adapter,'ASUClassSearchClient',Client)
    monkeypatch.setattr(syllabus,'download_document',lambda *args:(b'Syllabus excerpt','text/plain','https://asu.edu/syllabus.txt'))
    result=adapter.handler({'tool':'get_syllabus_evidence','input':{'term':'2271','subject':'CSE','catalog_nbr':'511','professor':'Requested Professor'}})['data']
    assert result['source_term']=='2267' and result['same_professor'] is False and result['historical'] is True
    assert 'Different instructor' in result['warning'] and 'Historical' in result['warning']
