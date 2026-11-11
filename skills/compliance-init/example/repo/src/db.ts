import { Pool } from "pg";
import type { Guest } from "./guests/model";

// The connection string comes from DATABASE_URL.
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function saveGuest(guest: Guest): Promise<void> {
  await pool.query(
    "INSERT INTO guests (id, full_name, email, phone, dietary_notes, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [guest.id, guest.fullName, guest.email, guest.phone, guest.dietaryNotes, guest.createdAt],
  );
}
