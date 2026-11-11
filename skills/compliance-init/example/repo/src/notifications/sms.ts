import { TextFlow } from "textflow-sdk";
import type { Guest } from "../guests/model";

const client = new TextFlow({ apiKey: process.env.TEXTFLOW_API_KEY });

// Sends the reminder the day before the booking.
export async function sendReminder(guest: Guest, bookedAt: Date): Promise<void> {
  if (!guest.phone) return;
  const text = `Hello ${guest.fullName}, your table is booked on ${bookedAt.toLocaleString("en-GB")}.`;
  await client.send({ to: guest.phone, text });
  console.log(`reminder sent to ${guest.phone} for guest ${guest.id}`);
}
