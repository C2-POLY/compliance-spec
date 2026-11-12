---
triggers: [b]
---
The questions of the fired triggers. When the step runs, those the issue already answers are stated back instead of asked; the answers below fill the rest.

1. b1: What is the provider called, and what does it do for us?
2. b2: In which country does it process the data, and if that is outside the EU/EEA, which safeguard covers the transfer?
3. b3: Is a data processing agreement signed with it (yes, no, unknown), and where is it (the signed agreement or the provider's standard terms)?
4. b4: Which personal data is sent to it?

Not asked: trigger a (the phone number is already in `guest-contact`, nothing new is collected), c (no new store, no retention change), d and f (no decision, no AI), e (what guests are told does not change).

## Answers used to write the expected manifest

- b1: BulkPing, SMS booking reminders for numbers outside the Netherlands.
- b2: United States (`US`); outside the EU/EEA, standard contractual clauses.
- b3: yes; BulkPing data processing agreement, signed 2026-10-30.
- b4: the guest contact data (`guest-contact`).
