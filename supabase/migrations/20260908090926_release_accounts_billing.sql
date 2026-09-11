CREATE SCHEMA IF NOT EXISTS app_private;
CREATE TABLE IF NOT EXISTS public.session (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL);
CREATE INDEX IF NOT EXISTS release_session_expire ON public.session(expire);
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.billing_accounts (
  breeder_id uuid PRIMARY KEY REFERENCES public.breeder(id),
  status text NOT NULL DEFAULT 'inactive',
  beta_access boolean NOT NULL DEFAULT false,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  checkout_session_id text,
  checkout_attempt uuid NOT NULL DEFAULT gen_random_uuid(),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
-- Existing breeders keep their test access. Never charge or suspend them implicitly.
INSERT INTO public.billing_accounts (breeder_id, beta_access, status)
SELECT id, true, 'beta' FROM public.breeder ON CONFLICT (breeder_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_private.auth_rate_limits (
  key_hash text PRIMARY KEY, hits integer NOT NULL, reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_rate_limits_expiry ON app_private.auth_rate_limits(reset_at);
CREATE TABLE IF NOT EXISTS app_private.account_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id),
  breeder_id uuid NOT NULL REFERENCES public.breeder(id),
  purpose text NOT NULL CHECK (purpose IN ('reset', 'verify')),
  session_version integer NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_private.billing_events (
  event_id text PRIMARY KEY, breeder_id uuid NOT NULL REFERENCES public.breeder(id), processed_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ALL TABLES IN SCHEMA app_private FROM PUBLIC;
