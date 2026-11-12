---
triggers: [a]
---
The questions of the fired triggers. When the step runs, those the issue already answers are stated back instead of asked; the answers below fill the rest.

1. a1: What is the new data, and is it identity, contact, financial, location, usage, professional, connection, health, special or credential data?
2. a2: Whose data is it (guests, staff, other)?
3. a3: Why is it collected, in one sentence?
4. a4: On what legal basis (consent, contract, legal obligation, legitimate interests, other, or not known yet), and what supports it (the contract or law relied on, why our interest outweighs the person's, or how consent is collected and withdrawn)?

Not asked: where it is stored (the issue names the main database, so it is written as `storage` id `main-db`), and triggers b, c, d, e and f (no new recipient, no new store, no retention change, no decision, no change to what guests are told, no AI).

## Answers used to write the expected manifest

- a1: a mobile phone number, contact data.
- a2: restaurant guests.
- a3: send the booking reminder by SMS.
- a4: consent (the field is optional and given by the guest). Detail: the guest types the number in an optional field of the booking form, whose label says it is used only for the reminder; the guest withdraws it by removing the number from the booking or by replying STOP to a reminder.
