# Compliance handoff: bistro-api

For the owner of `bistro-org/bistro-compliance` and the DPO. Prepared by the compliance-init skill from the code of `bistro-org/bistro-api` at commit `n/a (example folder, not a git checkout)`. It prepares documentation; it does not certify compliance. The manifest of this repo is `.compliance/manifest.yaml`; once this pull request is merged, the workflow sends it to the compliance repo.

## 1. Organisation and repo

The identity of the organisation, to fill once for the whole compliance repo, and the entry of this repo. Every `to complete` and `unknown` is an open item of the dossier until it is filled.

```yaml file=compliance.yaml
spec_version: "0.2"
organisation:
  name: Bistro Booking Group
  controller:
    legal_name: to complete
    address: to complete
    registration: to complete
    contact: to complete
  dpo:
    designated: unknown
  representative:
    required: unknown
  privacy_contact: to complete
repos:
  - name: bistro-api
    url: https://github.com/bistro-org/bistro-api
    owner: to complete
    expected_to_send: true
```

- `controller`: the legal name, address, registration number and data protection contact of Bistro Booking Group.
- `dpo`: `designated: true` with `name` and `contact`, or `designated: false` with the `reason` no DPO is required.
- `representative`: `required: false` (with a `reason`, e.g. "established in the EU") or `true` with `name` and `contact`.
- `privacy_contact`: where guests exercise their rights (an email address or a URL).

## 2. Processing activities

Draft files, one per processing activity. Review, complete and add them under `processings/`. They inherit the controller and the DPO from `compliance.yaml`.

### Table bookings

Why: guest contact details, booking details and the connection data of the booking requests are collected for the same purpose (take bookings and remind guests), for the same guests, on the same legal basis (contract). TextFlow SMS receives the contact details for the reminders.

```yaml file=processings/table-bookings/processing.yaml
spec_version: "0.2"
id: table-bookings
name: Table bookings
purpose: Take table bookings and remind guests of them by SMS.
data_subjects: [restaurant guests]
legal_basis: contract
information:
  notices:
    - {repo: bistro-api, id: privacy-page}
services:
  - repo: bistro-api
    data: [guest-contact, booking-details, request-metadata]
    recipients: [textflow-sms, send-sms]
source: {kind: declared, ref: "draft by compliance-init from bistro-api/.compliance/manifest.yaml, to be reviewed"}
```

### Dietary needs

Why: free-text dietary notes can reveal health or religion and rest on another legal basis (consent), so they are their own activity.

```yaml file=processings/dietary-needs/processing.yaml
spec_version: "0.2"
id: dietary-needs
name: Dietary needs
purpose: Record the dietary needs a guest mentions when booking.
data_subjects: [restaurant guests]
legal_basis: consent
information:
  notices:
    - {repo: bistro-api, id: privacy-page}
services:
  - repo: bistro-api
    data: [dietary-notes]
    recipients: []
source: {kind: declared, ref: "draft by compliance-init from bistro-api/.compliance/manifest.yaml, to be reviewed"}
```

### Replies to guests' questions

Why: the AI assistant drafts replies to guests' questions. The guest's name is also sent to ChatLoom (`guest-contact`, listed in Table bookings); the review may prefer to list it here too.

```yaml file=processings/guest-question-replies/processing.yaml
spec_version: "0.2"
id: guest-question-replies
name: Replies to guests' questions
purpose: Answer guests' questions, with AI-drafted replies edited and sent by staff.
data_subjects: [restaurant guests]
legal_basis: contract
information:
  notices:
    - {repo: bistro-api, id: privacy-page}
services:
  - repo: bistro-api
    data: [assistant-questions]
    recipients: [chatloom, ask-assistant]
source: {kind: declared, ref: "draft by compliance-init from bistro-api/.compliance/manifest.yaml, to be reviewed"}
```

## 3. For the DPO

The checks of each processing that the DPO settles in its `processing.yaml`. They were not asked to the developer; until they are written, each is an open item of the dossier. The hints come from the code and the answers.

### table-bookings

- Legal basis detail (`legal_basis_detail.reference`): the booking terms the guest accepts when booking.
- DPIA (`dpia`): no hint of a DPIA criterion in the code (no score, no special category, no monitoring).
- Information of persons (`information`): the privacy page of the booking website, declared in answer 8; check that it covers SMS reminders and the connection data.
- Sensitive data (`sensitive_data`): none found in these fields.
- Joint controllers (`joint_controllers`): none found in the code; `[]` once confirmed.

### dietary-needs

- Legal basis detail (`legal_basis_detail.consent`): how the guest's consent to record dietary notes is collected, and how it is withdrawn.
- DPIA (`dpia`): free text that may reveal health or religion (criterion `sensitive`).
- Information of persons (`information`): the privacy page; check that it mentions dietary notes.
- Sensitive data (`sensitive_data`): the notes may reveal `health` or `religious` data (field of category `special`).
- Joint controllers (`joint_controllers`): none found in the code; `[]` once confirmed.

### guest-question-replies

- Legal basis detail (`legal_basis_detail.reference`): the contract the replies serve (the booking, or the guest's request).
- DPIA (`dpia`): an AI system drafts the replies; staff review them (criterion `innovative` to assess).
- Information of persons (`information`): the privacy page; guests are not told that a reply is drafted by AI (answer 9).
- Sensitive data (`sensitive_data`): the question is free text of unknown content (category `unknown`): `to-assess`.
- Joint controllers (`joint_controllers`): none found in the code; `[]` once confirmed.

## 4. To define

- None: every `personal_data` entry fits one of the three activities above.

## 5. To complete in the compliance repo

- Security measures of each processing (nothing in the code states them).
- The retention each processing applies, if it differs from the stores in the manifest (`main-db`: three years after the last booking; `app-logs`: 30 days).
- The data processing agreement and the transfer safeguard for ChatLoom (United States): both are unknown.
- The receiving side: the `receive` workflow and the App that reads this repo (see the compliance-action README), and CODEOWNERS for `services/**`.
