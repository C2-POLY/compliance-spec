## Summary

First compliance manifest of `bistro-org/bistro-api`, drafted from the code by the compliance-init skill, and the workflow that keeps it in step with the code. It prepares documentation; it does not certify compliance. Nothing here is validated until a person reviews it.

Scanned commit: `n/a (example folder, not a git checkout)`. Evidence: `.compliance/findings.md`.

## Found in the code

What the code shows. Each line names the files; check the line numbers in `.compliance/findings.md`.

- `personal_data/guest-contact`: guest name, email, phone, in `src/guests/model.ts`, `src/guests/routes.ts`, `migrations/001.sql`
- `personal_data/dietary-notes`: free-text dietary notes, in `src/guests/model.ts`, `src/guests/routes.ts`, `migrations/001.sql`
- `personal_data/booking-details`: party size, booking date and time, in `migrations/001.sql`
- `personal_data/assistant-questions`: the question passed to the assistant, in `src/assistant/suggest.ts`
- `storage/main-db`: PostgreSQL (`DATABASE_URL`), in `src/db.ts`, `migrations/001.sql`
- `storage/app-logs`: the phone number and guest id are logged, in `src/notifications/sms.ts`
- `personal_data/request-metadata`: the IP address and technical headers of the guests' requests, seen by the host that serves `POST /guests`, in `src/guests/routes.ts`
- `processors/textflow-sms`, `outbound_flows/send-sms` (linked to the processor): SMS reminders through `textflow-sdk`, in `src/notifications/sms.ts`, `package.json`
- `processors/chatloom`, `outbound_flows/ask-assistant` (linked to the processor): prompt sent to `api.chatloom.example`, in `src/assistant/suggest.ts`
- `ai_features/reply-drafting`: AI-drafted replies returned to the back office, with its expected AI Act obligations (`art4-ai-literacy`, `art50-synthetic-content`), in `src/assistant/suggest.ts`
- No notice to guests (privacy page, banner, screen, email) in this repo.
- No automated decision about a person was found.

## Declared by a person

What the code does not show; it comes from the engineering lead, in answer to the questions asked during the run. Recorded in the manifest with a `declared` source or a `# declared: question <n>` comment.

- `service.controller` = `organisation` (question 1)
- `personal_data/guest-contact.legal_basis`, `booking-details.legal_basis`, `assistant-questions.legal_basis`, `request-metadata.legal_basis` = `contract` (question 3)
- `personal_data/dietary-notes.legal_basis` = `consent` (question 3)
- `storage/main-db`: retention `P3Y` after the last booking of the guest; EU region (Frankfurt) (question 4)
- `storage/app-logs`: collected by the hosting provider's log service, `P30D`, log rotation (question 4)
- `processors/textflow-sms`: country `NL`, DPA `yes`, `dpa_ref` "TextFlow SMS data processing agreement, signed 2025-09-02" (questions 5 and 6)
- `processors/chatloom`: country `US` (question 5)
- `outbound_flows/send-sms`, `outbound_flows/ask-assistant`: country `NL` and `US`; the organisation's account confirmed (questions 5 and 7)
- `notices/privacy-page`: the privacy page of the booking website, `https://bistro-booking.example/privacy` (question 8)
- `ai_features/reply-drafting`: guests are not told, so there is no `marking`; `risk.level` = `limited`, with its reason (question 9)

## Still unknown

What nobody answered and the code does not tell. Left out or `unknown` in the manifest.

- `processors/chatloom.dpa`: `unknown`; the data protection office could say whether an agreement is signed.
- `processors/chatloom.safeguard`: left out; the data goes to the United States and the safeguard is not known.
- `ai_features/reply-drafting.role`: `to-assess`; provider or deployer of the drafting feature, for the DPO.
- The organisation's identity (controller details, DPO, representative, privacy contact): `to complete` and `unknown` in the `compliance.yaml` of `.compliance/COMPLIANCE.md`.
- Owner of the repo, for the compliance repo (`to complete` in `.compliance/COMPLIANCE.md`).
- The DPO checks of the three draft processings (legal basis detail, DPIA, information, sensitive data, joint controllers): not asked here, listed for the DPO in `.compliance/COMPLIANCE.md`, section 3.
- Security measures of the processing activities: nothing in the code states them.

## To confirm

Values set by the skill that nobody settled. They are in the manifest; check them.

- `ai_features/reply-drafting.human_review` = `true`: inferred from the code, the draft is only returned to the back office and staff send it. Check that staff always review it.
- `ai_features/reply-drafting.obligations`: `art4-ai-literacy` = `open` (nothing in the code says staff were trained) and `art50-synthetic-content` = `open` (the code does not mark the draft as AI-generated). Set `done` with a `ref`, or `not-applicable`, once checked.

## What this adds

- `.compliance/manifest.yaml`: the manifest (5 personal data, 2 stores, 2 processors, 2 outbound flows, 0 decisions, 1 AI feature, 1 notice).
- `.compliance/findings.md`: the findings it was drafted from.
- `.compliance/COMPLIANCE.md`: for the owner of the compliance repo, the `compliance.yaml` with the organisation's identity to fill and this repo's entry, and draft processing files; for the DPO, the checks of each processing (legal basis detail, DPIA, information, sensitive data, joint controllers), which were not asked here.
- `.github/workflows/compliance.yml`: checks the manifest on pull requests (no secret), sends it to the compliance repo on pushes to `main`.

## Reviewer checklist

- [ ] Each line of "Found in the code" matches the code; nothing is missing (a store, a provider, an AI call).
- [ ] Each declared value is right, and the person who gave it is the right one to give it.
- [ ] Each "To confirm" value is right, or corrected.
- [ ] Each "Still unknown" has an owner and a date, or a decision to leave it.
- [ ] The workflow: `bistro-org/bistro-compliance`, the `compliance` environment and the App secrets exist; actions are pinned by SHA.
- [ ] `.compliance/COMPLIANCE.md` is handed to the owner of the compliance repo, and its section 3 to the DPO.
- [ ] No secret or personal data in the files.
