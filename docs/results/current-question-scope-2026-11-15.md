# Current-question and professor-review correction — November 15, 2026

Target: shared account 851725603471, us-east-2, app https://d1ia555vbcj8k2.cloudfront.net. Deployment completed successfully: Vibe-dev UPDATE_COMPLETE, agent/research functions Active/Successful, requested Haiku model retained, shared website/config HTTP 200. No IAM or stateful-resource changes.

Manual testing showed a specific professor/course question receiving a recap of earlier class-planning work and another professor's ratings, followed by repeated research warnings. Inspection found that memory retrieval used eight recent messages, including long assistant summaries, and clipped the combined query from its beginning. The model saw broad background goals/history without a separately pinned authenticated triggering request.

Changes:

- Pin the triggering request explicitly in the model's task instructions, separately from background party context. Earlier conversation resolves references; it is not a queue of old research tasks to complete. Professor assessments should answer the named question, with no unrelated class recommendations or other professors unless requested.
- Start retrieval with the current question, followed by short prior human context. Earlier assistant recaps do not become the retrieval query.
- Let the professor-review tool accept a course code. Return matching labelled course reviews preferentially within the existing bounded sample. If none match, explicitly label other/unspecified-course evidence rather than claiming no reviews exist. A bare number without a department does not establish a course-specific match.
- Preserve professor-wide ratings/counts as overall metrics, course/sample counts separately, source URLs and review dates. Compact review excerpts to preserve relevant evidence within the run budget; retain the existing ten-review/two-page source bound. Version the review cache to avoid the prior bulk response format.
- Deduplicate final warnings and frontend warnings, including already-stored duplicate warning strings. Use a human-readable limited-review-sample message.

Focused local verification passed 55 backend tests, five Python adapter tests, workspace typechecks and production build. Regressions cover current-question-first retrieval excluding assistant recaps, requested-course review selection, unknown/other-course labelling, bounded excerpts and warning deduplication. Reviewed CDK diff changes only agent/research code and frontend assets; no IAM or stateful-resource changes.

Per the user's preference, no additional live recommendation scenario was run. Model behavior remains for manual acceptance. Retry the same professor/course question in the existing party after refreshing. Expected behavior is a concise evidence-based assessment of that professor, clearly distinguishing course-specific reviews from overall metrics and other-course evidence. This report makes no factual claim about any real professor's teaching quality or ratings.
