# AWS model availability audit

Checked November 14, 2026 in account `851725603471`, region `us-east-2`, through the AWS MCP server. The selected region's text-model catalog returned 84 entries. Availability was queried for each entry. Catalog presence and access metadata are separate from a successful inference request.

## Selection

Use `deepseek.v3.2` for the main agent and extraction, with `minimax.minimax-m2.5` as the tested fallback. Both passed a complete Converse tool-call/result round trip. DeepSeek followed the class-planning next-step instruction most closely in the small synthetic scenario below. Keep model selection configurable.

Haiku 5.5 is denied for the account. Sonnet 4.6 and Haiku 4.5 returned a missing Anthropic use-case form error. The availability API's agreement field alone does not establish the exact corrective action or runtime access.

## Live invocation results

| Model | Observed result |
| --- | --- |
| `deepseek.v3.2` | Tool round trip passed |
| `openai.gpt-oss-120b-1:0` | Tool round trip passed |
| `minimax.minimax-m2.5` | Tool round trip passed |
| `moonshotai.kimi-k2.5` | Tool round trip passed |
| `anthropic.claude-haiku-5-5` | Invocation denied for this account |
| `amazon.nova-2-lite-v1:0` | Tool round trip passed |
| `anthropic.claude-haiku-4-5-20251001-v1:0` | Invocation requires use-case form |
| `anthropic.claude-sonnet-4-6` | Invocation requires use-case form |

The trivial tool probes used synthetic input and had no application side effects. Eight distinct model IDs were invoked across this readiness review. Other catalog entries received metadata checks only.

## Vibe-specific checks

The synthetic case has two students with explicit schedule constraints, a third person's claim about another student's preferences, three candidate sections, unknown prerequisites/labs, and an unaccepted task. The first pass used a loose schema and a 1,024-token output bound. MiniMax exhausted that bound. DeepSeek used pending for a task state that the app requires to be proposed. gpt-oss preserved the proposal and attribution fields but suggested enrollment as the next step.

A second pass used explicit enum constraints and a 2,048-token bound, matching the planned tool-validation approach.

| Model | Structured checks | Content observation | Reported model latency across two calls |
| --- | --- | --- | --- |
| `deepseek.v3.2` | 6/6 | Proposed verifying prerequisites, eligibility and labs | 9.63 seconds |
| `openai.gpt-oss-120b-1:0` | 6/6 | Proposed enrollment while marking eligibility unverified | 6.51 seconds |
| `minimax.minimax-m2.5` | 6/6 | Proposed the course and mentioned prerequisite/lab checks in the explanation | 9.55 seconds |

These are single synthetic cases, not a general quality ranking or production latency benchmark. Schema checks and deterministic authorization remain required. Record tool requests before executing mutations so regenerated responses cannot create duplicate actions.

## Full metadata audit

Fields are the returned authorization, entitlement, agreement and regional statuses. The invocation column reports only tests actually performed. Profile-based models use an appropriate inference profile when invoked.

| Model ID | Authorization | Entitlement | Agreement | Region | Invocation |
| --- | --- | --- | --- | --- | --- |
| `openai.gpt-6-astra` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `nvidia.nemotron-nano-12b-v2` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `openai.gpt-5.6-terra` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `anthropic.claude-haiku-4-5-20251001-v1:0` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Invocation requires use-case form |
| `qwen.qwen3-235b-a22b-2507-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `anthropic.claude-opus-5-5` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `moonshotai.kimi-k2.5` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Tool round trip passed |
| `openai.gpt-oss-120b-1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Tool round trip passed |
| `zai.glm-5.3` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `qwen.qwen3-next-80b-a3b` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `moonshotai.kimi-k3` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `anthropic.claude-fable-5` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `deepseek.v3.2` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Tool round trip passed |
| `anthropic.claude-haiku-5-5` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Invocation denied for this account |
| `twelvelabs.pegasus-1-5-v1:0` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `nvidia.nemotron-nano-3-30b` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `anthropic.claude-sonnet-4-6` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Invocation requires use-case form |
| `minimax.minimax-m2` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `zai.glm-4.7-flash` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `xai.grok-4.7` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `mistral.voxtral-mini-3b-2507` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `xai.grok-4.6` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `amazon.nova-pro-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `amazon.nova-2-lite-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Tool round trip passed |
| `minimax.minimax-m2.5` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Tool round trip passed |
| `google.gemma-3-12b-it` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `moonshot.kimi-k2-thinking` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `mistral.mistral-large-3-675b-instruct` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `twelvelabs.pegasus-1-2-v1:0` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `mistral.devstral-2-123b` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `minimax.minimax-m2.1` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `openai.gpt-6.1-terra` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `openai.gpt-6.1-sol` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `nvidia.nemotron-super-3-120b` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `qwen.qwen3-32b-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `mistral.ministral-3-14b-instruct` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `anthropic.claude-opus-4-6-v1` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `writer.palmyra-x5-v1:0` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `nvidia.nemotron-nano-9b-v2` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `mistral.ministral-3-8b-instruct` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `mistral.voxtral-small-24b-2507` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `zai.glm-5` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `openai.gpt-oss-20b-1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `anthropic.claude-opus-5` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `google.gemma-3-4b-it` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `anthropic.claude-opus-4-8` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `anthropic.claude-opus-4-7` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `openai.gpt-oss-safeguard-120b` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `google.gemma-3-27b-it` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `openai.gpt-6-sol` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `moonshotai.kimi-k3.1` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `writer.palmyra-x4-v1:0` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `anthropic.claude-sonnet-4-5-20250929-v1:0` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `qwen.qwen3-vl-235b-a22b` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `openai.gpt-6-luna` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `anthropic.claude-fable-5-1` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `zai.glm-4.7` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `writer.palmyra-vision-7b` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `openai.gpt-5.6-luna` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `anthropic.claude-sonnet-5-5` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `anthropic.claude-sonnet-5` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `anthropic.claude-opus-4-1-20250805-v1:0` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `qwen.qwen3-coder-480b-a35b-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `mistral.magistral-small-2509` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `anthropic.claude-fable-5-2` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `openai.gpt-5.6-sol` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `deepseek.v3-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `openai.gpt-5.4` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `mistral.ministral-3-3b-instruct` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `anthropic.claude-opus-4-5-20251101-v1:0` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `openai.gpt-5.5` | AUTHORIZED | AVAILABLE | NOT_AVAILABLE | AVAILABLE | Untested |
| `qwen.qwen3-coder-30b-a3b-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `openai.gpt-oss-safeguard-20b` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `amazon.nova-lite-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `amazon.nova-micro-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `deepseek.r1-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `mistral.pixtral-large-2502-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `meta.llama3-1-8b-instruct-v1:0:128k` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `meta.llama3-1-8b-instruct-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `meta.llama3-1-70b-instruct-v1:0:128k` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `meta.llama3-1-70b-instruct-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `meta.llama3-3-70b-instruct-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `meta.llama4-scout-17b-instruct-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |
| `meta.llama4-maverick-17b-instruct-v1:0` | AUTHORIZED | AVAILABLE | AVAILABLE | AVAILABLE | Untested |

## Source and reproducibility

AWS operations were ListFoundationModels with TEXT output, ListInferenceProfiles, GetFoundationModelAvailability for every catalog entry, and bounded Converse calls for the listed candidates. Source status may change before deployment. Rerun the selected model's capability check during deployment verification. [Availability API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_GetFoundationModelAvailability.html), [Bedrock pricing](https://aws.amazon.com/bedrock/pricing/)
