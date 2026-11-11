---
triggers: [a]
---
The questions of the fired triggers. When the step runs, those the issue already answers are stated back instead of asked; the answers below fill the rest.

1. a1: What is the new data, and is it identity, contact, financial, location, usage, professional, health, special or credential data?
2. a2: Whose data is it (guests, staff, other)?
3. a3: Why is it collected, in one sentence?
4. a4: On what legal basis (consent, contract, legal obligation, legitimate interests, other, or not known yet)?

Not asked: where it is stored (the issue names the main database, so it is written as `storage` id `main-db`), and triggers b, c and d (no new recipient, no new store, no retention change, no decision).

## Answers used to write the expected manifest

- a1: a mobile phone number, contact data.
- a2: restaurant guests.
- a3: send the booking reminder by SMS.
- a4: consent (the field is optional and given by the guest).
