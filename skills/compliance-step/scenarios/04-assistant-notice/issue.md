---
url: https://github.com/bistro-org/bistro-api/issues/54
---
**Title:** `Assistant: tell guests how their questions are used before the first message`

As a restaurant guest, I want to know what happens to what I type in the booking assistant, so that I can decide what to ask.

Today the chat window of the booking assistant (`src/assistant/chat.ts`) only says that the guest talks to an AI assistant. A short notice is added above the first message: what the assistant keeps, for how long, and a link to the privacy page of the website. Nothing else changes in the assistant.

**Acceptance criteria**

- [ ] The chat window shows the notice above the first message, in English and French
- [ ] The notice links to the privacy page
- [ ] A screenshot test covers the notice

Out of scope: changing the privacy page itself.
Shipped: `pending`
