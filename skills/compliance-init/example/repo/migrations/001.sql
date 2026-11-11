CREATE TABLE guests (
  id            uuid PRIMARY KEY,
  full_name     text NOT NULL,
  email         text NOT NULL,
  phone         text,
  dietary_notes text,
  created_at    timestamptz NOT NULL
);

CREATE TABLE bookings (
  id         uuid PRIMARY KEY,
  guest_id   uuid NOT NULL REFERENCES guests (id),
  party_size integer NOT NULL,
  booked_at  timestamptz NOT NULL
);
