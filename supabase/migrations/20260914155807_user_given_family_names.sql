-- Preserve legacy full names: their ordering does not reliably identify a given name.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name varchar(120);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name varchar(120);
