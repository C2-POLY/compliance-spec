// A guest of the restaurant, as stored in the guests table.
export interface Guest {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  dietaryNotes: string | null;
  createdAt: Date;
}
