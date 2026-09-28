-- Bootstrap only, as database owner. LOGIN wrappers and credentials are supplied out of band.
DO $$ BEGIN CREATE ROLE desk_migrator NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE desk_runtime NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE desk_operator NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT desk_runtime TO desk_operator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO desk_migrator;
GRANT USAGE ON SCHEMA public TO desk_runtime;
CREATE SCHEMA IF NOT EXISTS desk_internal AUTHORIZATION desk_migrator;
REVOKE ALL ON SCHEMA desk_internal FROM PUBLIC, desk_runtime;
-- Only objects created with CURRENT_USER = desk_migrator receive these defaults.
ALTER DEFAULT PRIVILEGES FOR ROLE desk_migrator IN SCHEMA public GRANT SELECT, INSERT ON TABLES TO desk_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE desk_migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- Do not blanket-grant existing tables: privileged decisions have explicit exceptions.
