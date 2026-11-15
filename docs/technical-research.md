# Technical research and decisions

Research date is November 14, 2026, America/Phoenix. The architecture specifies the technical selections. This document records evidence, costs and remaining verification.

## Local and provider status

| Item | Observed status |
| --- | --- |
| Node / npm | 24.8.0 / 11.6.0 available |
| AWS CLI | 2.0.30 available, too old for many current service commands |
| uvx / Codex CLI | 0.11.28 / 0.144.1 available |
| Context7 | Library resolution and documentation queries succeeded |
| AWS configuration | User selected account 851725603471 and Ohio. AWS MCP STS verified IAM user anishk |
| Project MCP configuration | AWS, Supermemory docs and TinyFish tools are now callable. Read/documentation checks succeeded |
| Supermemory and TinyFish keys | Present in ignored project `.env`. Supermemory authenticated read and TinyFish Search/Fetch succeeded |
| Existing Python tools | API guide, route implementations, dependencies and transport behavior inspected. Live source checks remain pending |
| Old external setup guide | Referenced `/Users/bhaveshbalaji/...` path is unavailable on this machine |

The user selected the account and Ohio and confirmed an existing budget. AWS reports Monthly Budget $50, with actual-threshold 80 and forecast-threshold 100 notifications configured. This budget covers the account, including other projects. Provider billing is separate. The legacy CLI can be bypassed with the working AWS MCP and current application SDKs. Deployment role permissions and quotas are checked when those roles are created.

## Primary model and alternatives

Select DeepSeek V3.2 through Bedrock using `deepseek.v3.2` in `us-east-2`, Converse and IAM execution-role credentials. MiniMax M2.5 is the tested fallback. Both completed live tool round trips. DeepSeek followed the requested prerequisite/lab verification task most closely in a small synthetic class-planning scenario. The model audit and its limits are in `model-availability.md`.

Haiku 5.5 is denied for this account despite an ACTIVE catalog profile. Sonnet 4.6 and Haiku 4.5 report missing Anthropic use-case details. An audit queried availability metadata for all 84 text entries returned in Ohio, and eight distinct IDs received invocation tests. Catalog metadata alone cannot establish runtime access.

| Model | USD input / 1M tokens | USD output / 1M tokens | Decision |
| --- | --- | --- | --- |
| Haiku 5.5, US geographic, up to 100K input | 0.11 | 0.55 | Account-denied target |
| Haiku 5.5, global, up to 100K input | 0.10 | 0.50 | Pricing reference for an alternative routing boundary |
| Nova 2 Lite | 0.30 | 2.50 | Tool test passed, included in audit |
| DeepSeek V3.2, US Standard | 0.62 | 1.85 | Selected agent and extraction |
| MiniMax M2.5, US Standard | 0.30 | 1.20 | Tested fallback |
| Kimi K2.5, US Standard | 0.60 | 3.00 | Tool test passed |

AWS's price page uses dynamic placeholders. Resolve them against its public pricing dataset for Ohio. The Haiku global table returns 0.10/0.50 and geographic table returns 0.11/0.55. This is retained as reference pricing for the account-denied Haiku target. Prompts above 100K tokens have a higher pricing tier. [AWS pricing](https://aws.amazon.com/bedrock/pricing/), [Public AWS price data](https://b0.p.awsstatic.com/pricing/2.0/meteredUnitMaps/bedrockfoundationmodels/USD/current/bedrockfoundationmodels.json)

Nova rates also appear in AWS technical material. DeepSeek's US rates are directly readable on the main price page. Prices exclude credits and account-specific arrangements. [Nova rate evidence](https://aws.amazon.com/blogs/big-data/build-rag-ready-indexes-from-amazon-s3-with-amazon-opensearch-intelligent-ingestion/), [Bedrock pricing](https://aws.amazon.com/bedrock/pricing/)

DeepSeek V3.2 is active and its Converse tools were verified directly in Ohio. The GLM 4.7 Flash public card says Legacy while the live catalog says ACTIVE, so its lifecycle needs reconciliation before adoption. DeepSeek V4.1 Flash was absent from the returned Ohio text catalog. [DeepSeek](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-deepseek-deepseek-v3-2.html), [GLM](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-zai-glm-4-7-flash.html)

## Supermemory services

Use hosted API v5 and official TypeScript SDK `supermemory`. The inspected registry release is 5.1.2. Select document ingestion, Memory processing, SuperRAG, namespace-scoped search, profiles/buckets, document status, explicit updates, deletion and exact forgetting. [SDK](https://supermemory.ai/docs/integrations/supermemory-sdk.md)

Private personal memory, approved shared personal facts and party conversation have separate namespaces. Group-agent access is derived from current membership and sharing approval. Memory ingestion handles curated facts, while SuperRAG retains searchable history. Supermemory manages indexing and embeddings. [Namespaces](https://supermemory.ai/docs/concepts/container-tags.md), [Ingestion](https://supermemory.ai/docs/ingestion/add-memories.md)

Existing-ID add calls support append/diff behavior. Explicit document update replaces content. Dynamic dreaming can leave a new profile empty for minutes, while instant dreaming incurs another operation and still needs processing status checks. Profile summaries can aggregate several facts. DynamoDB therefore retains authoritative approval, correction and deletion versions. [Replacement](https://supermemory.ai/docs/migration/api-v5-document-updates.md), [Quickstart](https://supermemory.ai/docs/quickstart.md), [Aggregation](https://supermemory.ai/docs/user-profiles/buckets.md)

Hermes provides a precedent for bounded user and agent notes plus history search. Vibe adapts compact summaries with structured permission and version records. [Hermes memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory)

## TinyFish services

Use `@tiny-fish/sdk`, inspected release 0.11.0, with Search, Fetch and asynchronous TinyAgent research. Search discovers sources, Fetch returns rendered source content, and the Vibe model synthesizes the evidence. Public-site interaction uses an isolated browser research job with cancellation and a wall-clock deadline. [Integration guide](https://docs.tinyfish.ai/for-coding-agents.md)

Current public pricing lists Search and Fetch as free within allowances, TinyAgent at $0.016/step and TinyBrowser at $0.002/minute. The Search reference and pricing FAQ describe different allowance windows. Budget against the stricter published limits and verify the user's legacy credits or current wallet terms. [Pricing](https://www.tinyfish.ai/pricing), [Search](https://docs.tinyfish.ai/search-api/reference.md)

TinyAgent's `max_steps` cap is beta, so use `max_duration_seconds` independently. A browser estimate based on average steps is not an exact spending ceiling. Fetch supports a per-URL timeout. The official Fetch and replacement documents were readable directly when the web reader failed. [Execution limits](https://docs.tinyfish.ai/agent/explanation/agent-modes.md), [Fetch](https://docs.tinyfish.ai/fetch-api/reference.md)

## SameClass integration

The user authorized course-search and professor-review reuse. The Python packages expose search, course details, syllabus evidence, professor resolution and review pagination. They retain normalized meetings, source links, timestamps and coverage. They have no database or model requirement and no application authentication. The selected deployment is an IAM-invoked Python Lambda with a narrow tool adapter. [Existing API guide](../sameclass-track3/docs/api-guide.md), [Source provenance](../sameclass-track3/SOURCE_NOTES.md)

The source uses `respect_retry_after_header=False` and checks aggregate deadlines between requests. The Vibe wrapper must bound total work and handle rate-limit responses. Historical checks do not establish current upstream health. A bounded live smoke scenario remains an implementation acceptance gate. [Transport](../sameclass-track3/class_search_api/transport.py), [Prior review](../sameclass-track3/docs/integration-validation.md)

## AWS decisions

| Service | Selected role and research finding |
| --- | --- |
| Cognito | Stable user identity, email verification and a public app client |
| HTTP API and Lambda | JWT-protected routes with application membership checks |
| AppSync Events | Cognito subscription and IAM publish modes, synchronous membership authorization |
| DynamoDB | Canonical state, conditional transactions, Streams and durable outbox |
| SQS FIFO | Serialized party/namespace work with consumer idempotency |
| Lambda | Bounded agent, memory and existing Python research execution |
| AgentCore Runtime | Evaluated for long-lived execution. Resumable jobs fit the selected Lambda design |
| SES | Application-sent invites after sender verification and recipient-delivery access |

[Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/signing-up-users-in-your-app.html), [AppSync](https://docs.aws.amazon.com/appsync/latest/eventapi/configure-event-api-auth.html), [Transactions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html), [Queue processing](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html), [AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/), [SES](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)

## Context7 and dependency checks

| Library | Check |
| --- | --- |
| `/aws-amplify/amplify-js` | Manual Cognito configuration and Events user-pool subscriptions |
| `/tanstack/query` | Cursor pagination and external-event query invalidation |
| `/kludex/mangum` | ASGI-to-Lambda support, available if HTTP research hosting becomes necessary |

All three queries succeeded. The selected Python tool path directly invokes retrieval clients. Registry inspection also found CDK 2.277.0 and Bedrock Runtime SDK 3.1169.0. Scaffolding will lock compatible versions. [Amplify](https://github.com/aws-amplify/amplify-js), [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview), [Mangum](https://github.com/Kludex/mangum)

## Illustrative cost scenario

The following monthly scenario is derived from assumed volumes and published rates, with credits excluded.

| Workload | Assumption | USD estimate |
| --- | --- | --- |
| Agent | 1,000 runs, 2 calls/run, each 8K input and 1K output tokens | 13.62 |
| Extraction | 500 calls, each 1K input and 200 output tokens | 0.495 |
| Memory ingest | 200K unique text tokens | 1.00 |
| SuperRAG ingest | 200K unique text tokens | 0.20 |
| Memory search | 5K queries | 0.025 |
| Extra memory operations | 500 instant/add-on operations | 0.05 |
| AppSync | 100K operations and 100K connection minutes | 0.108, excluding transfer |
| Optional TinyAgent | 20 runs averaging 20 steps | 6.40 |

Selected DeepSeek inference is `16M × $0.62 + 2M × $1.85 = $13.62`. The same token volume is $7.20 with MiniMax M2.5 and $9.80 with Nova. Include every model/tool round and all billed output when measuring actual use.

The selected-model subtotal is about $15.50 before browser research and $21.90 with the optional TinyAgent example. API Gateway, Lambda, DynamoDB transactions/indexes/storage/PITR, SQS, SSM, S3/CloudFront, Cognito, logs, alarms and email are additional. The existing $50 account budget is confirmed. The subtotal leaves room for infrastructure at this illustrative scale, but other account workloads, additional tool rounds and provider charges must be included in actual spend. Budget alerts do not prevent overage.

Supermemory meters Memory text at $0.005/1K tokens, SuperRAG text at $0.001/1K tokens, search at $0.005/1K queries and add-on operations at $0.10/1K. SDK call count and billable-operation count differ. [Billing](https://supermemory.ai/docs/overview/billing.md)

AppSync Events costs $1/million operations and $0.08/million connection minutes. Notifications fan out to recipients, and handlers also contribute operations. [AppSync pricing](https://aws.amazon.com/appsync/pricing/)

Verify infrastructure costs against the selected region and actual usage. Budget alerts notify, while application quotas and concurrency settings control use. [Lambda](https://aws.amazon.com/lambda/pricing/), [API Gateway](https://aws.amazon.com/api-gateway/pricing/), [DynamoDB](https://aws.amazon.com/dynamodb/pricing/), [CloudWatch](https://aws.amazon.com/cloudwatch/pricing/)

## Remaining readiness checks

Scope and architecture approval is the remaining user decision before coding. The account, Ohio region, existing budget and selected operational model are recorded. Deployment checks must verify Lambda-role permissions and quotas. The memory milestone includes synthetic write/search/replacement/deletion tests, and the course milestone includes fresh ASU/RMP health checks. These integrations do not block scaffolding and the initial chat flow.

Application-sent email depends on an SES sender and delivery access. Link and QR joining cover the first milestone. The repository uses `https://github.com/aniiishhh/vibe.git` as origin. Preserve source provenance for reused tools and record any event-rule clarification for submission.
