-- Demonstration only; contract #99/PR #101 still requires joint review.
SET LOCAL ROLE sunny_owner;
SET LOCAL search_path = pg_catalog, app;

CREATE TABLE app.orders (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES auth."user"(id) ON DELETE RESTRICT,
    product_slug text NOT NULL CHECK (length(product_slug) BETWEEN 1 AND 100),
    product_kind text NOT NULL CHECK (product_kind IN ('bracelet','necklace')),
    product_name text NOT NULL CHECK (length(product_name) BETWEEN 1 AND 200),
    catalog_source text NOT NULL CHECK (catalog_source = 'DEMO_CATALOG'),
    color text NOT NULL CHECK (color IN ('red','orange','blue','yellow','violet')),
    length_cm integer NOT NULL,
    status text NOT NULL DEFAULT 'REQUESTED' CHECK (status = 'REQUESTED'),
    mode text NOT NULL DEFAULT 'DEMO' CHECK (mode = 'DEMO'),
    preview_confirmed boolean NOT NULL CHECK (preview_confirmed),
    preview_confirmed_at timestamptz(3) NOT NULL,
    idempotency_key uuid NOT NULL,
    request_payload_hash text NOT NULL CHECK (request_payload_hash ~ '^[a-f0-9]{64}$'),
    created_at timestamptz(3) NOT NULL,
    UNIQUE(id,owner_id), UNIQUE(owner_id,idempotency_key),
    CHECK ((product_kind='bracelet' AND length_cm IN (16,18,20)) OR (product_kind='necklace' AND length_cm IN (40,45,50))),
    CHECK (preview_confirmed_at=created_at)
);
CREATE INDEX orders_owner_page ON app.orders(owner_id,created_at DESC,id DESC);
CREATE TABLE app.order_beads (
    order_id uuid NOT NULL, owner_id uuid NOT NULL,
    slot_index integer NOT NULL CHECK (slot_index BETWEEN 0 AND 6), photo_asset_id uuid,
    PRIMARY KEY(order_id,slot_index),
    FOREIGN KEY(order_id,owner_id) REFERENCES app.orders(id,owner_id) ON DELETE RESTRICT,
    FOREIGN KEY(photo_asset_id,owner_id) REFERENCES app.photo_assets(id,owner_id) ON DELETE RESTRICT
);
CREATE INDEX order_beads_photo ON app.order_beads(photo_asset_id) WHERE photo_asset_id IS NOT NULL;
CREATE TABLE app.order_consents (
    order_id uuid NOT NULL, owner_id uuid NOT NULL,
    consent_type text NOT NULL CHECK (consent_type IN ('photoProductionConsent','photoBrandUseConsent')),
    accepted boolean NOT NULL, policy_version text NOT NULL, policy_text text NOT NULL CHECK (length(policy_text)>0),
    policy_sha256 text NOT NULL CHECK (policy_sha256 ~ '^[a-f0-9]{64}$'),
    accepted_at timestamptz(3), recorded_at timestamptz(3) NOT NULL,
    PRIMARY KEY(order_id,consent_type),
    FOREIGN KEY(order_id,owner_id) REFERENCES app.orders(id,owner_id) ON DELETE RESTRICT,
    CHECK ((accepted AND accepted_at IS NOT NULL AND accepted_at=recorded_at) OR (NOT accepted AND accepted_at IS NULL)),
    CHECK ((consent_type='photoProductionConsent' AND policy_version='SUNNY_DEMO_PRODUCTION_V1')
        OR (consent_type='photoBrandUseConsent' AND policy_version='SUNNY_DEMO_BRAND_V1'))
);

ALTER TABLE app.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE app.order_beads ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.order_beads FORCE ROW LEVEL SECURITY;
ALTER TABLE app.order_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.order_consents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.orders,app.order_beads,app.order_consents FROM PUBLIC,sunny_auth,sunny_app;
GRANT SELECT,INSERT ON app.orders,app.order_beads,app.order_consents TO sunny_app;
CREATE POLICY orders_owner ON app.orders TO sunny_app
  USING (owner_id=nullif(current_setting('app.user_id',true),'')::uuid)
  WITH CHECK (owner_id=nullif(current_setting('app.user_id',true),'')::uuid);
CREATE POLICY order_beads_owner ON app.order_beads TO sunny_app
  USING (owner_id=nullif(current_setting('app.user_id',true),'')::uuid)
  WITH CHECK (owner_id=nullif(current_setting('app.user_id',true),'')::uuid);
CREATE POLICY order_consents_owner ON app.order_consents TO sunny_app
  USING (owner_id=nullif(current_setting('app.user_id',true),'')::uuid)
  WITH CHECK (owner_id=nullif(current_setting('app.user_id',true),'')::uuid);

-- INVOKER: no elevated privilege, no RLS bypass. Validate final transaction state.
CREATE FUNCTION app.check_order_request() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,app AS $$
DECLARE ids uuid[]; target uuid; photos integer; slots integer; stamp timestamptz;
BEGIN
  IF TG_TABLE_NAME='orders' THEN
    IF TG_OP='DELETE' THEN ids:=ARRAY[OLD.id];
    ELSIF TG_OP='INSERT' THEN ids:=ARRAY[NEW.id]; ELSE ids:=ARRAY[OLD.id,NEW.id]; END IF;
  ELSE
    IF TG_OP='DELETE' THEN ids:=ARRAY[OLD.order_id];
    ELSIF TG_OP='INSERT' THEN ids:=ARRAY[NEW.order_id]; ELSE ids:=ARRAY[OLD.order_id,NEW.order_id]; END IF;
  END IF;
  FOREACH target IN ARRAY ids LOOP
    SELECT created_at INTO stamp FROM app.orders WHERE id=target;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT count(*),count(photo_asset_id) INTO slots,photos FROM app.order_beads WHERE order_id=target;
    IF slots<>7 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Order requires exactly seven slots'; END IF;
    IF photos>0 AND NOT EXISTS(SELECT 1 FROM app.order_consents
      WHERE order_id=target AND consent_type='photoProductionConsent' AND accepted) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Order requires production consent';
    END IF;
    IF photos=0 AND EXISTS(SELECT 1 FROM app.order_consents WHERE order_id=target) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Photo-free order cannot record photo consents';
    END IF;
    IF EXISTS(SELECT 1 FROM app.order_consents WHERE order_id=target AND recorded_at<>stamp) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Order receipt timestamp mismatch';
    END IF;
    IF EXISTS(SELECT 1 FROM app.order_beads b LEFT JOIN app.photo_assets p
      ON (p.id,p.owner_id)=(b.photo_asset_id,b.owner_id)
      WHERE b.order_id=target AND b.photo_asset_id IS NOT NULL
      AND (p.id IS NULL OR p.status<>'verified' OR p.access_blocked_at IS NOT NULL)) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Order photo is not eligible';
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION app.check_order_request() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER orders_complete AFTER INSERT OR UPDATE OR DELETE ON app.orders
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_order_request();
CREATE CONSTRAINT TRIGGER order_beads_complete AFTER INSERT OR UPDATE OR DELETE ON app.order_beads
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_order_request();
CREATE CONSTRAINT TRIGGER order_consents_complete AFTER INSERT OR UPDATE OR DELETE ON app.order_consents
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_order_request();
