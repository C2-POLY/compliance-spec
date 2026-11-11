import { z } from "zod";
import type { Guest } from "./model";
import { saveGuest } from "../db";

// Body of POST /guests, filled in by the booking form.
export const guestForm = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  dietaryNotes: z.string().max(500).optional(),
});

export async function createGuest(body: unknown): Promise<Guest> {
  const input = guestForm.parse(body);
  const guest: Guest = {
    id: crypto.randomUUID(),
    ...input,
    phone: input.phone ?? null,
    dietaryNotes: input.dietaryNotes ?? null,
    createdAt: new Date(),
  };
  await saveGuest(guest);
  return guest;
}
