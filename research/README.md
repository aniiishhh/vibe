# Course and professor adapter

Vibe's backend invokes this Python 3.12 Lambda through IAM. No public HTTP endpoint or provider credentials are included. The typed TypeScript allowlist mediates access, arguments, time and result budgets. Only read-only research is supported. Open-ended recommendations use level/keyword discovery from real offerings before course-specific lookups, rather than generating catalog numbers from memory.

## Source and provenance

The user authorized reuse from [SameClass / Ray](https://github.com/BhaveshBalaji/sameclass-track3), pinned to commit `3292dea39915a9c8f611d638847af0414ecfce27`. `vendor/class_search_api/` and `vendor/rmp_api/` contain only the retrieval clients and their normalization, schedule, syllabus and transport dependencies. Original file comments are retained. Vibe also adapts the same pinned revision’s `bot/src/domain/semester.ts` as `backend/src/semester.ts` so semester names are normalized before Python invocation. [Upstream source notes](UPSTREAM_SOURCE_NOTES.md) preserve the earlier Class_Helper and Track 1 provenance. No LICENSE file was found at the pinned revision; this records project-specific authorization, not a general redistribution license.

ASU and Rate My Professors interfaces are unofficial. Results include source URLs and observation dates. Professor resolution defaults explicitly to Tempe because ASU school names can be duplicated across campuses; reviews are bounded subjective samples. Public syllabus fallbacks retain their term labels and missing syllabi remain not_found. No registration or account action is performed.

## Build and check

```sh
npm run build:research
npm run test:research
```

The builder uses Python/pip to download pinned binary wheels for Linux x86_64 CPython 3.12, copies the adapter and vendor modules into ignored `research/dist/`, and clears only that generated directory. CDK expects that asset before synthesis. For adapter tests, install `research/requirements.txt` and pytest into a project-local `.venv`; pytest is a development dependency, not a Lambda dependency.

The adapter limits discovery to two pages, eight distinct level-filtered courses and two sampled sections per course; specific ASU search to two pages/five sections, professor reviews to two pages of ten by default (up to six pages per call with a continuation cursor), and automatic syllabus fallback to six prior terms under a 60-second budget with 6,000 characters of page excerpts. Requested-term/same-professor material is preferred, then historical same-professor material, then explicitly labelled other-instructor material. Explicit fallback lists, including current-only, are supported. Its Lambda has a 90-second timeout. TypeScript imposes a separate run budget and 15-minute cache for successful non-seat source responses; class seat searches and discovery are live. No private synthesis is stored in this public-result cache.

Live verification and remaining acceptance checks are recorded in ../STATUS.md. Offline checks do not establish future source availability, enrollment eligibility, complete reviews or a missing syllabus's existence.

Class filters exposed to both search and discovery include keywords, instructor name, course level, campus/delivery, session, days/dates, units, college and open/honors options. Search can use a keyword or instructor without a course number. Arguments are allowlisted and normalized to the existing ASU client; arbitrary upstream URLs/parameters are not accepted. RMP can return general reviews/overall metrics or labelled course-specific samples with sample-level averages. Those averages are not a complete course-specific RMP aggregate.
