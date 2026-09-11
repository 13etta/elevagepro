-- New writes cannot attach an animal, sale, document or record to another breeder.
-- Existing records are preserved; unrelated edits on historical records stay possible.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
CREATE OR REPLACE FUNCTION app_private.enforce_tenant_reference()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE parent_id text; old_parent_id text; owner_id text; found_parent boolean;
BEGIN
  owner_id := to_jsonb(NEW)->>'breeder_id';
  parent_id := to_jsonb(NEW)->>TG_ARGV[0];
  IF TG_OP = 'UPDATE' THEN
    old_parent_id := to_jsonb(OLD)->>TG_ARGV[0];
    IF parent_id IS NOT DISTINCT FROM old_parent_id AND owner_id IS NOT DISTINCT FROM (to_jsonb(OLD)->>'breeder_id') THEN RETURN NEW; END IF;
  END IF;
  IF parent_id IS NULL THEN RETURN NEW; END IF;
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Breeder required' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT true FROM %I.%I WHERE %I::text = $1 AND breeder_id::text = $2 FOR KEY SHARE', TG_ARGV[1], TG_ARGV[2], TG_ARGV[3])
    INTO found_parent USING parent_id, owner_id;
  IF found_parent IS DISTINCT FROM true THEN RAISE EXCEPTION 'Reference outside breeder' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION app_private.keep_breeder_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.breeder_id IS DISTINCT FROM OLD.breeder_id THEN
    RAISE EXCEPTION 'Breeder ownership is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.enforce_tenant_reference() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.keep_breeder_ownership() FROM PUBLIC;
DO $$
DECLARE r record; trigger_name text;
BEGIN
  FOR r IN
    SELECT c.table_name FROM information_schema.columns c WHERE c.table_schema='public' AND c.column_name='breeder_id'
  LOOP
    trigger_name := 'release_keep_breeder';
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=format('public.%I',r.table_name)::regclass AND tgname=trigger_name) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OF breeder_id ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.keep_breeder_ownership()',trigger_name,r.table_name);
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.table_name);
  END LOOP;
  FOR r IN
    SELECT DISTINCT child.relname child_table, ca.attname child_column, pn.nspname parent_schema, parent.relname parent_table, pa.attname parent_column
    FROM pg_constraint fk
    JOIN pg_class child ON child.oid=fk.conrelid JOIN pg_namespace cn ON cn.oid=child.relnamespace
    JOIN pg_class parent ON parent.oid=fk.confrelid JOIN pg_namespace pn ON pn.oid=parent.relnamespace
    JOIN pg_attribute ca ON ca.attrelid=child.oid AND ca.attnum=fk.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid=parent.oid AND pa.attnum=fk.confkey[1]
    WHERE fk.contype='f' AND array_length(fk.conkey,1)=1 AND cn.nspname='public' AND pn.nspname='public'
      AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=child.oid AND attname='breeder_id' AND NOT attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=parent.oid AND attname='breeder_id' AND NOT attisdropped)
    UNION
    SELECT 'dogs','infrastructure_id','public','infrastructures','id'
    UNION SELECT 'puppies','infrastructure_id','public','infrastructures','id'
    UNION SELECT 'dog_movements','dog_id','public','dogs','id'
    UNION SELECT 'expenses','dog_id','public','dogs','id'
    UNION SELECT 'expenses','puppy_id','public','puppies','id'
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=r.child_table AND column_name=r.child_column) THEN CONTINUE; END IF;
    trigger_name := 'release_tenant_' || r.child_column;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=format('public.%I',r.child_table)::regclass AND tgname=trigger_name) THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.enforce_tenant_reference(%L,%L,%L,%L)', trigger_name,r.child_table,r.child_column,r.parent_schema,r.parent_table,r.parent_column);
    END IF;
  END LOOP;
  -- Harden existing registry functions without replacing their bodies or changing data.
  FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND (p.proname LIKE 'registry_%' OR p.proname='archive_exited_dog')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public',r.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',r.signature);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon',r.signature); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated',r.signature); END IF;
  END LOOP;
END;
$$;
