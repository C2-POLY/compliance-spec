---
triggers: [e]
---
The questions of the fired triggers. When the step runs, those the issue already answers are stated back instead of asked; the answers below fill the rest.

1. e1: What tells the persons about their data here (a privacy page, an in-app screen, a consent banner, an email), or is there nothing yet?
2. e2: Where is it (a URL, a file path or a screen name), and which part of the service shows it?

Not asked: triggers a, b, c, d and f (no new data, no new recipient, no new store, no retention change, and the assistant itself does not change).

## Answers used to write the expected manifest

- e1: an in-app screen: a notice in the chat window.
- e2: the chat window of the booking assistant, above the first message, with a link to the privacy page; shown by the API component.
