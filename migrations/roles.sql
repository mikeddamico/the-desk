-- Execute as a database owner. Passwords are supplied out-of-band by the platform.
DO $$ BEGIN CREATE ROLE desk_migrator NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE desk_runtime NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT USAGE ON SCHEMA public TO desk_runtime;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO desk_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM desk_runtime;
REVOKE CREATE ON SCHEMA public FROM desk_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE desk_migrator IN SCHEMA public GRANT SELECT, INSERT ON TABLES TO desk_runtime;
