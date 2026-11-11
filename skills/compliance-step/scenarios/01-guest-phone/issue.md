---
url: https://github.com/bistro-org/bistro-api/issues/51
---
**Title:** `Bookings: a guest can leave a mobile number to get a reminder`

As a restaurant guest, I want to leave a mobile number when I book, so that I can get a reminder before my table.

Today a reminder can only go by email, and guests miss it. The number is optional and is saved with the booking in the main database (`bistro-api`, `src/bookings/guest.ts`). Sending the SMS itself is a separate issue.

**Acceptance criteria**

- [ ] The booking form has an optional mobile number field
- [ ] The number is saved with the booking in the main database
- [ ] A booking without a number still works as before
- [ ] A test books with and without a number

Out of scope: sending the SMS.
Shipped: `pending`
