-- Rôles
CREATE TYPE public.app_role AS ENUM ('admin', 'locataire');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

-- Entreprises
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text NOT NULL UNIQUE,
  share_percent numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Réglages globaux
CREATE TABLE public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  monthly_pool_hours numeric NOT NULL DEFAULT 200,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Profils
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Rôles utilisateurs
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Domaines autorisés
CREATE TABLE public.allowed_domains (
  domain text PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'locataire',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.allowed_domains TO authenticated;
GRANT ALL ON public.allowed_domains TO service_role;
ALTER TABLE public.allowed_domains ENABLE ROW LEVEL SECURITY;

-- Ajustements de quota
CREATE TABLE public.quota_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  month date NOT NULL,
  hours numeric NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.quota_adjustments TO authenticated;
GRANT ALL ON public.quota_adjustments TO service_role;
ALTER TABLE public.quota_adjustments ENABLE ROW LEVEL SECURITY;

-- Demandes de dépassement
CREATE TABLE public.overage_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  requester_email text NOT NULL,
  requested_hours numeric NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.overage_requests TO authenticated;
GRANT ALL ON public.overage_requests TO service_role;
ALTER TABLE public.overage_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER overage_requests_updated_at BEFORE UPDATE ON public.overage_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Réservations rattachées
ALTER TABLE public.reservations
  ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN user_id uuid;
GRANT SELECT ON public.reservations TO authenticated;

-- Policies
CREATE POLICY "companies visibles aux connectes" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies gerees par admin" ON public.companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "settings visibles aux connectes" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings geres par admin" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "profil personnel" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profil modifiable par admin" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "roles personnels" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "domaines lisibles par admin" ON public.allowed_domains FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ajustements visibles" ON public.quota_adjustments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR company_id = public.current_company_id());

CREATE POLICY "depassements visibles" ON public.overage_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR company_id = public.current_company_id());
CREATE POLICY "depassements crees par locataire" ON public.overage_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND company_id = public.current_company_id());

CREATE POLICY "reservations visibles par entreprise" ON public.reservations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR company_id = public.current_company_id());

-- Données initiales
INSERT INTO public.app_settings (id, monthly_pool_hours) VALUES (true, 200);

INSERT INTO public.companies (id, name, domain, share_percent) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Alpha Conseil', 'alpha.fr', 50),
  ('22222222-2222-4222-8222-222222222222', 'Beta Studio', 'beta.fr', 30),
  ('33333333-3333-4333-8333-333333333333', 'Gamma Legal', 'gamma.fr', 20);

INSERT INTO public.allowed_domains (domain, company_id, role) VALUES
  ('alpha.fr', '11111111-1111-4111-8111-111111111111', 'locataire'),
  ('beta.fr', '22222222-2222-4222-8222-222222222222', 'locataire'),
  ('gamma.fr', '33333333-3333-4333-8333-333333333333', 'locataire'),
  ('nova-serenity.fr', NULL, 'admin');