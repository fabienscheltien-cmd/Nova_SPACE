ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accueil';

CREATE TABLE IF NOT EXISTS public.allowed_emails (
  email text PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  role public.app_role NOT NULL DEFAULT 'locataire',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.allowed_emails TO authenticated;
GRANT ALL ON public.allowed_emails TO service_role;
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read allowed emails" ON public.allowed_emails FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS booked_by_email text;