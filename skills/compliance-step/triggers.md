# Triggers

The compliance step asks questions only when a change touches one of six things. This file explains the triggers; the machine-readable mapping is [`triggers.yaml`](triggers.yaml) (trigger id, then questions, each with an `id`, a `text` and the manifest `field` path its answer fills, and for a4 the `processing` paths of the processing file its detail feeds). Nothing is generated from the YAML: the skill reads it. `npm test` checks that every path exists in the v0.2 [manifest schema](../../schema/v0.2/manifest.schema.json) or [processing schema](../../schema/v0.2/processing.schema.json).

Detection looks at the issue text, and at the diff when there is one. A signal in the issue is enough to fire a trigger; a code signal in the diff fires it even when the issue says nothing. When unsure whether a signal is real, fire the trigger: one extra question costs less than a missing manifest entry.

Questions are few (2 to 4 per trigger) and plain. A question is asked only if the issue and the diff do not already answer it; an answer found in the text is written down and stated back, not asked again.

## a. New personal data field

A person can be identified or contacted from something the service did not hold before.

| Signal in the issue | Signal in the diff |
| --- | --- |
| "add the guest's phone / birthday / address / photo / IP / device id", "collect", "ask the user for", "profile", "preference", "history", "track", "log the IP", "user agent" | New field on a model or struct that names a person's attribute, new column or migration, new form input, new API request or response field, new analytics or log property carrying a user attribute, code that starts reading the IP address, headers or a device id (`req.ip`, `X-Forwarded-For`, `user-agent`), a new endpoint persons reach in a service that had none |

| Question | Manifest field |
| --- | --- |
| a1. What is the new data, and what kind? | `personal_data[].fields[].category` (and `name`); an IP address, technical headers or a device id is `connection` |
| a2. Whose data is it? | `personal_data[].subjects` |
| a3. Why is it collected? | `personal_data[].purpose` |
| a4. On what legal basis, and what supports it? | `personal_data[].legal_basis` (`unknown` is allowed: leave it out and add a `TODO`). Not asked when `service.controller` is `user-of-the-app`: the value is `not-applicable` (also for an entry of a component whose `controller` is `user-of-the-app`). The detail (GDPR Art. 6 and 7: the contract or law relied on, the balancing test of legitimate interests, how consent is collected and withdrawn) has no manifest field: it goes to the Compliance section, for `legal_basis_detail` of the processing file |

The field is added to the `personal_data` entry of the same purpose, or to a new entry when the purpose is new. If the issue or the diff names the store that holds it, add its id to that store's `data` list; if no store is named, write a `TODO` in the section.

## b. New external service or recipient

Personal data leaves the service towards someone who was not a recipient yesterday.

| Signal in the issue | Signal in the diff |
| --- | --- |
| "send through / via / to X", "integrate", "connect to", "webhook", "provider", "SaaS", "API of", "export to", a vendor name | New HTTP client call to an external host, new SDK in `package.json` / `go.mod` / `requirements.txt`, new env var such as `*_API_KEY`, `*_TOKEN`, `*_WEBHOOK_URL`, new outbound webhook or e-mail sender |

| Question | Manifest field |
| --- | --- |
| b1. What is the provider, and what does it do for us? | `processors[].name` (and `service`, `outbound_flows[].to.name`) |
| b2. In which country does it process the data, and what safeguard if outside the EU/EEA? | `processors[].country` (and `transfer_outside_eu`, `safeguard`); for a recipient that is not a processor, `outbound_flows[].to.country` and `outbound_flows[].safeguard` |
| b3. Is a data processing agreement signed, and where is it? | `processors[].dpa` (`unknown` is allowed) and `processors[].dpa_ref` |
| b4. Which personal data is sent? | `processors[].data` (and `outbound_flows[].data`) |

A contracted provider is a `processors` entry plus an `outbound_flows` entry (`account: organisation`) whose `processor` is the processor's id. A recipient reached with the user's own account or no account is an `outbound_flows` entry only (`account: user` or `none`): skip b3. An already-known processor receiving new data is not a new recipient: add the data to its `data` list and ask b4 only.

## c. New storage or retention change

Personal data rests somewhere new, or stays for a different time.

| Signal in the issue | Signal in the diff |
| --- | --- |
| "store", "save", "persist", "cache", "keep for", "archive", "backup", "delete after", "purge", "retention", "TTL" | New table, collection, bucket, cache key space, queue with persistence, log sink, backup job; new or changed TTL, expiry, cron purge, `ON DELETE`, retention setting |

| Question | Manifest field |
| --- | --- |
| c1. Where is it stored? | `storage[].location` (and `kind`) |
| c2. Which personal data does it hold? | `storage[].data` |
| c3. How long is it kept? | `storage[].retention.duration` (`none`, `session`, `unknown` are allowed) |
| c4. What event starts the clock or ends the retention? | `storage[].retention.trigger` |

Adding a column to a table that already holds the same personal data, with the same retention, is trigger a only.

## d. Automated decision or AI feature

The service decides something about a person without a human (GDPR Art. 22), or uses AI that talks to people or generates content (AI Act Art. 50 transparency).

| Signal in the issue | Signal in the diff |
| --- | --- |
| "automatically", "score", "rank", "block", "approve / reject", "eligible", "risk", "fraud", "recommend", "personalise", "AI", "LLM", "model", "chatbot", "assistant", "generate" | LLM SDK or API client (Anthropic, OpenAI-style, local model runtime), prompt files, embeddings, scoring or threshold logic that changes what a person gets (price, access, deposit, ban), classifier or ML model files |

| Question | Manifest field |
| --- | --- |
| d1. What does the system decide or generate, and who is affected? | `automated_decisions[].description` or `ai_features[].description` |
| d2. Does the decision have a legal or similarly significant effect? | `automated_decisions[].legal_or_similar_effect` |
| d3. Can a human review or override the result? | `automated_decisions[].human_review` or `ai_features[].human_review` |
| d4. How are persons told it is AI? | `ai_features[].marking` (and `interacts_with_persons`, `generates_content`) |

Ask d2 only for a decision, d4 only for an AI feature that talks to persons or generates content. A feature can be both: ask all four. If the AI reads personal data, list it in `ai_features[].data`, and fire trigger a when that data is new. A new AI feature also fires trigger f.

## e. Notice to persons

What the persons are told about their data changes (GDPR Art. 13 and 14): a privacy page, a consent banner, an onboarding or settings screen that speaks of data, or an email that informs them, is added, moved, removed or rewritten.

| Signal in the issue | Signal in the diff |
| --- | --- |
| "privacy policy", "privacy page", "cookie banner", "consent", "terms", "onboarding", "tell the user", "inform", "notice", "unsubscribe" | New or changed privacy or legal page or route, consent or cookie banner component or consent-management SDK, permission usage strings (`NS...UsageDescription`), an onboarding screen whose text is about data, an email template with a privacy notice or an unsubscribe link |

| Question | Manifest field |
| --- | --- |
| e1. What tells the persons, or is there nothing yet? | `notices[].kind` (`page`, `screen`, `banner`, `email`, or `none`) |
| e2. Where is it, and which part of the service shows it? | `notices[].ref` (a URL, a file path or a screen name) and `notices[].component` |

A changed notice keeps its `id`: update `kind` or `ref`. A removed notice with nothing in its place becomes `kind: none`, so the dossier keeps the information check open; it is never deleted silently. A text change that does not alter what the persons are told (a typo, a new layout) does not fire. Which processing a notice informs about is written in the processing file (`information.notices`) by the DPO: say in the Compliance section which processing it concerns, when the issue tells.

## f. AI role or risk change

The organisation's place under the AI Act changes for a feature: a new AI feature (trigger d fired for AI), or an existing one whose role or use changes.

| Signal in the issue | Signal in the diff |
| --- | --- |
| "fine-tune", "train our model", "our own model", "under our name", "white label", "publish the assistant", "use it for hiring / credit / scoring persons / exams / access to a service", "emotion", "face", "biometric", "deepfake", "voice clone" | Training or fine-tuning code or jobs, model files added, a model provider replaced by a self-hosted model, an AI output newly used to decide about persons, emotion recognition or biometric categorisation libraries, generated images, audio or video of real persons |

| Question | Manifest field |
| --- | --- |
| f1. Do we build it or put it into service under our name, or use someone else's system as it is? | `ai_features[].role` (`provider`, `deployer`, `to-assess`) |
| f2. What is it used for, and what risk level does that give? Why? | `ai_features[].risk.level` (`prohibited`, `high`, `limited`, `minimal`, `to-assess`) and `risk.reason` |
| f3. Which AI duties are already met, and where? | `ai_features[].obligations[]`: `id`, `status` (`done`, `open`, `not-applicable`), `ref` |

The questions stay plain: the skill maps the answers to the AI Act terms. `obligations` lists every obligation the spec expects for the feature after the change (`spec/manifest.md`, `ai_features`: `art4-ai-literacy` always, `art50-interaction` when it talks to persons, `art50-synthetic-content` when it generates content, the high-risk ones for `high`); one the answers do not settle is `status: open`. An unknown role or level is `to-assess`, never a guess. A prompt change, a model version bump with the same provider, or a new screen over the same feature does not fire.

## Does not trigger

Do not ask anything, and write `GDPR impact: none`, for:

- UI-only changes: colours, copy, layout, icons, animations, translations, accessibility fixes that add no data.
- A refactor, rename or dependency bump with no new data, recipient, store or decision.
- Tests, fixtures with fictional data, documentation, CI.
- Reading data the service already holds, in the same place, for the same purpose.
- A bug fix that changes no data flow.
- A new endpoint or screen over data already in the manifest, with the same purpose (its connection data is already listed).

If the diff contradicts the issue (the issue says "UI only" and the diff adds an SDK), the diff wins: fire the trigger.
