-- #93 development upload implementation. No change to applied authentication SQL.
SET LOCAL ROLE sunny_owner;
SET LOCAL search_path = app, pg_catalog;

CREATE TABLE app.photo_assets (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES auth."user"(id) ON DELETE RESTRICT,
    purpose text NOT NULL CHECK (purpose = 'custom_order_photo'),
    declared_mime text NOT NULL CHECK (declared_mime IN ('image/jpeg', 'image/png')),
    declared_bytes integer NOT NULL CHECK (declared_bytes BETWEEN 1 AND 10485760),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','inspecting','verified','rejected','expired')),
    pending_key text NOT NULL UNIQUE CHECK (pending_key ~ '^pending/[a-f0-9-]{36}$'),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    put_expires_at timestamptz NOT NULL,
    complete_expires_at timestamptz NOT NULL,
    pending_cleanup_after timestamptz NOT NULL,
    inspection_token uuid,
    inspection_expires_at timestamptz,
    verified_key text UNIQUE,
    mime_type text CHECK (mime_type IN ('image/jpeg', 'image/png')),
    bytes integer CHECK (bytes BETWEEN 1 AND 10485760),
    width integer CHECK (width BETWEEN 1000 AND 8000),
    height integer CHECK (height BETWEEN 1000 AND 8000),
    sha256 text CHECK (sha256 ~ '^[a-f0-9]{64}$'),
    rejection_code text CHECK (rejection_code IN ('FILE_TOO_LARGE','UNSUPPORTED_IMAGE_TYPE',
        'INVALID_IMAGE_FILE','IMAGE_DIMENSIONS_TOO_SMALL','IMAGE_ASPECT_RATIO_NOT_ALLOWED')),
    access_blocked_at timestamptz,
    UNIQUE (id, owner_id),
    CHECK (put_expires_at > created_at AND complete_expires_at > put_expires_at
        AND pending_cleanup_after > put_expires_at),
    CHECK ((status = 'inspecting' AND inspection_token IS NOT NULL AND inspection_expires_at IS NOT NULL)
        OR (status <> 'inspecting' AND inspection_token IS NULL AND inspection_expires_at IS NULL)),
    CHECK ((status = 'verified' AND verified_key IS NOT NULL AND mime_type IS NOT NULL
        AND bytes IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL AND sha256 IS NOT NULL
        AND width::bigint * height <= 40000000 AND verified_key ~ '^verified/[a-f0-9-]{36}$')
        OR (status <> 'verified' AND verified_key IS NULL AND mime_type IS NULL
        AND bytes IS NULL AND width IS NULL AND height IS NULL AND sha256 IS NULL)),
    CHECK ((status = 'rejected' AND rejection_code IS NOT NULL) OR (status <> 'rejected' AND rejection_code IS NULL))
);
CREATE INDEX photo_assets_owner_created ON app.photo_assets(owner_id, created_at);
CREATE INDEX photo_assets_stale_inspection ON app.photo_assets(inspection_expires_at) WHERE status = 'inspecting';

-- Persist candidate keys before R2 I/O so unknown outcomes can be reconciled.
CREATE TABLE app.photo_upload_attempts (
    id uuid PRIMARY KEY,
    asset_id uuid NOT NULL,
    owner_id uuid NOT NULL REFERENCES auth."user"(id) ON DELETE RESTRICT,
    object_key text NOT NULL UNIQUE CHECK (object_key ~ '^verified/[a-f0-9-]{36}$'),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    published_at timestamptz,
    FOREIGN KEY (asset_id, owner_id) REFERENCES app.photo_assets(id, owner_id) ON DELETE RESTRICT
);
CREATE INDEX photo_upload_attempts_asset ON app.photo_upload_attempts(asset_id);

ALTER TABLE app.photo_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.photo_assets FORCE ROW LEVEL SECURITY;
ALTER TABLE app.photo_upload_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.photo_upload_attempts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.photo_assets, app.photo_upload_attempts FROM PUBLIC, sunny_auth, sunny_app;
GRANT SELECT, INSERT, UPDATE ON app.photo_assets, app.photo_upload_attempts TO sunny_app;
CREATE POLICY photo_assets_owner ON app.photo_assets FOR ALL TO sunny_app
    USING (owner_id = nullif(current_setting('app.user_id', true), '')::uuid)
    WITH CHECK (owner_id = nullif(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY photo_upload_attempts_owner ON app.photo_upload_attempts FOR ALL TO sunny_app
    USING (owner_id = nullif(current_setting('app.user_id', true), '')::uuid)
    WITH CHECK (owner_id = nullif(current_setting('app.user_id', true), '')::uuid);
