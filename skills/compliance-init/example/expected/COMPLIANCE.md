# Compliance handoff: bistro-api

For the owner of `bistro-org/bistro-compliance`. Prepared by the compliance-init skill from the code of `bistro-org/bistro-api` at commit `n/a (example folder, not a git checkout)`. It prepares documentation; it does not certify compliance. The manifest of this repo is `.compliance/manifest.yaml`; once this pull request is merged, the workflow sends it to the compliance repo.

## 1. Register the repo

Add this entry to `repos` in `compliance.yaml`:

```yaml file=compliance.yaml
- name: bistro-api
  url: https://github.com/bistro-org/bistro-api
  owner: to complete
  expected_to_send: true
```

## 2. Processing activities

Draft files, one per processing activity. Review, complete and add them under `processings/`.

### Table bookings

Why: guest contact details and booking details are collected for the same purpose (take bookings and remind guests), for the same guests, on the same legal basis (contract). TextFlow SMS receives the contact details for the reminders.

```yaml file=processings/table-bookings/processing.yaml
spec_version: "0.1"
id: table-bookings
name: Table bookings
purpose: Take table bookings and remind guests of them by SMS.
controller: {name: Bistro Booking Group, contact: to complete}
data_subjects: [restaurant guests]
legal_basis: contract
services:
  - repo: bistro-api
    data: [guest-contact, booking-details]
    recipients: [textflow-sms, send-sms]
source: {kind: declared, ref: "draft by compliance-init from bistro-api/.compliance/manifest.yaml, to be reviewed"}
```

### Dietary needs

Why: free-text dietary notes can reveal health or religion and rest on another legal basis (consent), so they are their own activity.

```yaml file=processings/dietary-needs/processing.yaml
spec_version: "0.1"
id: dietary-needs
name: Dietary needs
purpose: Record the dietary needs a guest mentions when booking.
controller: {name: Bistro Booking Group, contact: to complete}
data_subjects: [restaurant guests]
legal_basis: consent
services:
  - repo: bistro-api
    data: [dietary-notes]
    recipients: []
source: {kind: declared, ref: "draft by compliance-init from bistro-api/.compliance/manifest.yaml, to be reviewed"}
```

### Replies to guests' questions

Why: the AI assistant drafts replies to guests' questions. The guest's name is also sent to ChatLoom (`guest-contact`, listed in Table bookings); the review may prefer to list it here too.

```yaml file=processings/guest-question-replies/processing.yaml
spec_version: "0.1"
id: guest-question-replies
name: Replies to guests' questions
purpose: Answer guests' questions, with AI-drafted replies edited and sent by staff.
controller: {name: Bistro Booking Group, contact: to complete}
data_subjects: [restaurant guests]
legal_basis: contract
services:
  - repo: bistro-api
    data: [assistant-questions]
    recipients: [chatloom, ask-assistant]
source: {kind: declared, ref: "draft by compliance-init from bistro-api/.compliance/manifest.yaml, to be reviewed"}
```

## 3. To define

- None: every `personal_data` entry fits one of the three activities above.

## 4. To complete in the compliance repo

- Controller contact, data protection officer, security measures of each processing (nothing in the code states them).
- The retention each processing applies, if it differs from the stores in the manifest (`main-db`: three years after the last booking; `app-logs`: 30 days).
- The data processing agreement and the transfer safeguard for ChatLoom (United States): both are unknown.
- The receiving side: the `receive` workflow and the App that reads this repo (see the compliance-action README), and CODEOWNERS for `services/**`.
