CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE public.reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id text NOT NULL,
  location text NOT NULL,
  date date NOT NULL,
  slot text NOT NULL,
  hours numeric(4,2) NOT NULL CHECK (hours > 0 AND hours <= 8),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  during tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  confidential boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservations_time_order CHECK (ends_at > starts_at),
  CONSTRAINT reservations_no_overlap EXCLUDE USING gist (room_id WITH =, during WITH &&)
);

CREATE INDEX reservations_room_date_idx ON public.reservations (room_id, date);

GRANT ALL ON public.reservations TO service_role;

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;