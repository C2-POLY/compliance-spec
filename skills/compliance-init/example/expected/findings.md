# Compliance findings

- Repo: `bistro-org/bistro-api`
- Scanned commit: `n/a (example folder, not a git checkout)`
- Scanned on: `2026-11-11`
- Scope: the whole repo (`example/repo/`)

This file lists what the code shows. It prepares documentation; it does not certify compliance.

## personal_data

| # | What | Where (file:line) | Confidence | Becomes |
| --- | --- | --- | --- | --- |
| P1 | A guest has a full name, an email address and an optional phone number: type, booking form schema and `guests` table. Purpose inferred from the README (booking reminders). | `src/guests/model.ts:4-6`, `src/guests/routes.ts:7-9`, `migrations/001.sql:3-5` | found | personal_data/guest-contact, question 3 |
| P2 | A guest can add free-text dietary notes (up to 500 characters). Free text about diet can reveal health or religion, so the category is `special` (a hint for the DPO's sensitive data and DPIA checks, not a question). | `src/guests/model.ts:7`, `src/guests/routes.ts:10`, `migrations/001.sql:6` | found | personal_data/dietary-notes, question 4 |
| P3 | A booking has a party size and a date and time, linked to a guest. | `migrations/001.sql:10-15` | found | personal_data/booking-details, question 3 |
| P4 | A free-text question is passed to the assistant together with the guest. That it is the guest's own question is inferred from the comment and the README. | `src/assistant/suggest.ts:3-4`, `src/assistant/suggest.ts:9` | inferred | personal_data/assistant-questions, question 3 |
| P5 | The API receives the booking form as `POST /guests`: the host that serves it sees the IP address and the technical headers of every guest's request. The code does not read or store them. | `src/guests/routes.ts:5-6`, `src/guests/routes.ts:13` | inferred | personal_data/request-metadata, question 3 |

## storage

| # | What | Where (file:line) | Confidence | Becomes |
| --- | --- | --- | --- | --- |
| S1 | PostgreSQL database, connection string read from `DATABASE_URL`; tables `guests` and `bookings`. Region not in the code. | `src/db.ts:1`, `src/db.ts:4-5`, `migrations/001.sql:1-15` | found | storage/main-db, question 4 |
| S2 | No deletion, expiry or purge of `guests` or `bookings` anywhere (searched `DELETE`, `ttl`, `expire`, `purge`, `cleanup`, `cron`): retention is not stated by the code. | `migrations/001.sql:1-15` | inferred | storage/main-db, question 4 |
| S3 | The reminder code logs the guest's phone number and guest id to the standard output. Where that output ends up is not in the code. | `src/notifications/sms.ts:11` | found | storage/app-logs, question 4 |

## processors

| # | What | Where (file:line) | Confidence | Becomes |
| --- | --- | --- | --- | --- |
| R1 | SMS provider "TextFlow" through `textflow-sdk`; a secret is configured via `TEXTFLOW_API_KEY`. Country, DPA and where the DPA is not in the code. | `package.json`, `src/notifications/sms.ts:1`, `src/notifications/sms.ts:4` | found | processors/textflow-sms, question 5, question 6 |
| R2 | Language-model provider "ChatLoom" (`api.chatloom.example`); a secret is configured via `CHATLOOM_API_KEY`. Country, DPA and where the DPA is not in the code. | `src/assistant/suggest.ts:5`, `src/assistant/suggest.ts:7` | found | processors/chatloom, question 5, question 6 |

## outbound_flows

| # | What | Where (file:line) | Confidence | Becomes |
| --- | --- | --- | --- | --- |
| O1 | The guest's name and the booking date are sent in the SMS text, and the phone number as recipient, to TextFlow. The account is the organisation's (inferred: the key comes from the environment). Linked to processor `textflow-sms`. | `src/notifications/sms.ts:9-10` | found | outbound_flows/send-sms, question 5, question 7 |
| O2 | The guest's name and the guest's question are sent to ChatLoom in the prompt. The account is the organisation's (inferred: the key comes from the environment). Linked to processor `chatloom`. | `src/assistant/suggest.ts:5-10` | found | outbound_flows/ask-assistant, question 5, question 7 |

## automated_decisions

None found. Searched `score`, `rank`, `risk`, `threshold`, `approve`, `reject`, `block`: no logic decides something about a guest.

## ai_features

| # | What | Where (file:line) | Confidence | Becomes |
| --- | --- | --- | --- | --- |
| A1 | A language model drafts a reply to a guest's question and generates text (`generates_content: true`); no guest talks to it (`interacts_with_persons: false`); the draft is only returned to the back office and "staff edit and send it" (comment), so `human_review: true` is inferred from the code and flagged "to confirm". Whether guests are told it is AI is not in the code. AI Act: the feature calls a third party's model under the organisation's key (a hint of `deployer`, but the feature is put into service by the organisation: role unclear); it drafts text and decides nothing about the guest (a hint of `limited`). Expected obligations: `art4-ai-literacy` (not in the code), `art50-synthetic-content` (no marking of the draft in the code): both `open`, to confirm. | `src/assistant/suggest.ts:3-13` | inferred | ai_features/reply-drafting, question 9 |

## notices

None found. Searched `privacy`, `consent`, `cookie`, `terms`, `notice`, `gdpr`: the API serves no page, screen, banner or email text that tells guests about their data. Becomes question 8.

## Not counted

| What | Where | Why |
| --- | --- | --- |
| Four fictional guests (name, email, phone, dietary notes) | `tests/fixtures/guests.json` | Test fixture with fictional data |
| `typescript`, `vitest` | `package.json:12-13` | Dev-only dependencies, nothing shipped |
| Product description | `README.md` | Documentation; used for `service` only |

Dev-only files that may hold personal data (a decision for a person, not a finding):

- None found.

## Questions

What the code cannot tell, one question per topic. They are asked in one message; unanswered ones stay `unknown` or out of the manifest, except question 1, which blocks the manifest.

1. Controller (blocking). Hint: the code is a server API run by an organisation (feeds `service.controller`).
2. Who is answering? (recorded as the source of the answers)
3. Legal basis for `guest-contact`, `booking-details`, `assistant-questions`, `dietary-notes`, `request-metadata` (feeds `personal_data/*.legal_basis`).
4. Retention, start event and region for `main-db` and `app-logs` (feeds `storage/*`).
5. Country of each recipient, and the safeguard if outside the EU/EEA, for `textflow-sms`, `send-sms`, `chatloom`, `ask-assistant` (feeds `processors/*`, `outbound_flows/*.to.country`).
6. Data processing agreement for `textflow-sms`, `chatloom`, and where it is (feeds `processors/*.dpa`, `processors/*.dpa_ref`).
7. Whose account is used, inferred as the organisation's, for `send-sms`, `ask-assistant` (feeds `outbound_flows/*.account`).
8. Where guests are told about their data (a privacy page, a banner, a screen or an email), since this repo shows none (feeds `notices`).
9. For `reply-drafting`: how guests are told it is AI, its AI Act role (provider or deployer) and its risk level, with why (feeds `ai_features/reply-drafting.marking`, `.role`, `.risk`).

Not asked: the legal basis detail, the DPIA, the sensitive data and the joint controllers. They are the DPO's checks, handed over in `.compliance/COMPLIANCE.md`, section 3.
