---
url: https://github.com/bistro-org/bistro-api/issues/52
---
**Title:** `Reminders: guests abroad get the booking reminder through BulkPing`

As a restaurant guest who books from outside the Netherlands, I want the reminder by SMS to reach me, so that I do not miss my table.

Reminders by SMS go through TextFlow SMS, which does not deliver reliably outside the Netherlands. The worker (`src/notifications/sms.ts`) will send those reminders through BulkPing, a second SMS provider, using the guest's contact data already held (name and phone number). TextFlow stays in place for Dutch numbers. A `BULKPING_API_KEY` is added to the worker configuration.

**Acceptance criteria**

- [ ] The worker sends the reminder through BulkPing when the number is not Dutch
- [ ] TextFlow still handles Dutch numbers
- [ ] A failed BulkPing call is logged without the phone number
- [ ] A test covers both routes with a fake provider

Out of scope: changing the content of the reminder.
Shipped: `pending`
