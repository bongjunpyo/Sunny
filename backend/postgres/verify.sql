-- Read-only checks on the dedicated sunny development database.
SELECT current_database() AS database, session_user AS login_role;
SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolinherit, rolbypassrls
FROM pg_roles
WHERE rolname IN ('sunny_admin', 'sunny_owner', 'sunny_app', 'sunny_auth')
ORDER BY rolname;

SELECT nspname AS schema, pg_get_userbyid(nspowner) AS owner
FROM pg_namespace WHERE nspname IN ('sunny_meta', 'auth', 'app') ORDER BY nspname;

SELECT version, name, checksum, applied_at, applied_by, execution_ms
FROM sunny_meta.schema_migrations ORDER BY version;

SELECT role_name,
       has_database_privilege(role_name, 'sunny', 'CONNECT') AS can_connect,
       has_database_privilege(role_name, 'sunny', 'CREATE') AS can_create_schema,
       has_database_privilege(role_name, 'sunny', 'TEMP') AS can_create_temp,
       has_schema_privilege(role_name, 'app', 'USAGE') AS app_usage,
       has_schema_privilege(role_name, 'auth', 'USAGE') AS auth_usage,
       has_schema_privilege(role_name, 'app', 'CREATE') AS app_ddl,
       has_schema_privilege(role_name, 'auth', 'CREATE') AS auth_ddl,
       pg_has_role(role_name, 'sunny_owner', 'MEMBER') AS is_owner_member
FROM (VALUES ('sunny_app'), ('sunny_auth')) AS runtime_roles(role_name);

-- All rows must have sunny_owner as owner, including sequences and functions.
SELECT n.nspname AS schema, c.relname AS object, c.relkind::text AS kind,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('sunny_meta', 'auth', 'app')
UNION ALL
SELECT n.nspname, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       'function', pg_get_userbyid(p.proowner)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('sunny_meta', 'auth', 'app')
ORDER BY 1, 2;

-- Global PUBLIC EXECUTE must be absent; no schema-specific grant may add it back.
SELECT COALESCE(n.nspname, '(global)') AS scope, d.defaclobjtype AS object_type, d.defaclacl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE d.defaclrole = 'sunny_owner'::regrole ORDER BY 1, 2;

SELECT role_name, database_name,
       has_database_privilege(role_name, database_name, 'CONNECT') AS can_connect,
       has_database_privilege(role_name, database_name, 'TEMP') AS can_create_temp
FROM (VALUES ('sunny_app'), ('sunny_auth')) AS runtime_roles(role_name)
CROSS JOIN (VALUES ('postgres'), ('template1')) AS other_databases(database_name);
