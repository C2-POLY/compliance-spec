---
url: https://github.com/bistro-org/bistro-api/issues/55
---
**Title:** `Assistant: answer guests with our own fine-tuned model, as the Bistro Booking Assistant`

As a restaurant guest, I want the booking assistant to know the menus and the house rules of each restaurant, so that its answers are right.

Today the booking assistant runs a general-purpose open model as it is. We fine-tune that model on our menus and our frequently asked questions, and the assistant is shown to guests as the "Bistro Booking Assistant". It keeps running on our servers in the EU region (`src/assistant/**`): no new provider, no new data, and it still only answers questions about opening hours and menus.

**Acceptance criteria**

- [ ] The fine-tuning job runs from `src/assistant/training/`
- [ ] The chat window shows the "Bistro Booking Assistant" name
- [ ] Answers about menus are checked against a test set before release

Out of scope: taking bookings through the assistant.
Shipped: `pending`
