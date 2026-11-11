# Declared answers of the example

Invented for the example; they stand for what a person would answer to the eight questions of `findings.md`. One answer per topic, with a line per item. The expected manifest and `COMPLIANCE.md` are written from them.

1. Controller: the organisation, Bistro Booking Group.
2. Answered by: the engineering lead (recorded as a role, not a name).
3. Legal basis:
   - guest-contact: contract
   - booking-details: contract
   - assistant-questions: contract
   - dietary-notes: consent
4. Retention, start event, region:
   - main-db: three years after the guest's last booking; EU, Frankfurt region
   - app-logs: 30 days, log rotation; collected by the hosting provider's log service
5. Country and safeguard:
   - textflow-sms: Netherlands
   - send-sms: Netherlands
   - chatloom: United States; safeguard not known
   - ask-assistant: United States
6. Data processing agreement:
   - textflow-sms: yes
   - chatloom: not known
7. Account used:
   - send-sms: the organisation's, confirmed
   - ask-assistant: the organisation's, confirmed
8. Marking of reply-drafting: guests are not told AI was used (staff send the reply in their own name).

What stays unknown after these answers: the DPA with ChatLoom, the transfer safeguard for ChatLoom, the owner of the repo for the compliance repo, the controller contact and the security measures. To confirm: `human_review: true` of reply-drafting, inferred from the code.
