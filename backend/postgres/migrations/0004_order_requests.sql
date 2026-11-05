-- Initial multi-item demonstration orders. Contract #99/PR #101 requires joint review.
-- Unmerged 0004/0005 consolidated by team-lead request; no existing database is upgraded here.
SET LOCAL ROLE sunny_owner;
SET LOCAL search_path = pg_catalog, app;

CREATE TABLE app.order_checkouts (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth."user"(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  request_payload_hash text NOT NULL CHECK(request_payload_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'REQUESTED' CHECK(status='REQUESTED'),
  mode text NOT NULL DEFAULT 'DEMO' CHECK(mode='DEMO'),
  created_at timestamptz(3) NOT NULL,
  UNIQUE(id,owner_id), UNIQUE(owner_id,idempotency_key)
);
CREATE INDEX order_checkouts_owner_page ON app.order_checkouts(owner_id,created_at DESC,id DESC);

CREATE TABLE app.orders (
    id uuid PRIMARY KEY,
    owner_id uuid NOT NULL REFERENCES auth."user"(id) ON DELETE RESTRICT,
    product_slug text NOT NULL CHECK (length(product_slug) BETWEEN 1 AND 100),
    product_kind text NOT NULL CHECK (product_kind IN ('bracelet','necklace')),
    product_name text NOT NULL CHECK (length(product_name) BETWEEN 1 AND 200),
    catalog_source text NOT NULL CHECK (catalog_source = 'DEMO_CATALOG'),
    color text NOT NULL CHECK (color IN ('red','orange','blue','yellow','violet') OR (product_kind='bracelet' AND color='mixed')),
    length_cm integer NOT NULL,
    preview_confirmed boolean NOT NULL CHECK (preview_confirmed),
    preview_confirmed_at timestamptz(3) NOT NULL,
    created_at timestamptz(3) NOT NULL,
    checkout_id uuid NOT NULL,
    item_position integer NOT NULL CHECK (item_position BETWEEN 0 AND 19),
    quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 10),
    UNIQUE(id,owner_id), UNIQUE(checkout_id,item_position),
    FOREIGN KEY(checkout_id,owner_id) REFERENCES app.order_checkouts(id,owner_id) ON DELETE RESTRICT,
    CHECK ((product_kind='bracelet' AND length_cm IN (16,18,20)) OR (product_kind='necklace' AND length_cm IN (40,45,50))),
    CHECK (preview_confirmed_at=created_at)
);
CREATE TABLE app.order_beads (
    order_id uuid NOT NULL, owner_id uuid NOT NULL,
    slot_index integer NOT NULL CHECK (slot_index BETWEEN 0 AND 6), photo_asset_id uuid,
    shape text NOT NULL CHECK (shape IN ('square','round','moon')),
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

ALTER TABLE app.order_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.order_checkouts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.order_checkouts FROM PUBLIC,sunny_auth,sunny_app;
GRANT SELECT,INSERT ON app.order_checkouts TO sunny_app;
CREATE POLICY order_checkouts_owner ON app.order_checkouts TO sunny_app
  USING(owner_id=nullif(current_setting('app.user_id',true),'')::uuid)
  WITH CHECK(owner_id=nullif(current_setting('app.user_id',true),'')::uuid);

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
DECLARE ids uuid[]; target uuid; photos integer; slots integer; stamp timestamptz; kind text;
BEGIN
  IF TG_TABLE_NAME='orders' THEN
    IF TG_OP='DELETE' THEN ids:=ARRAY[OLD.id];
    ELSIF TG_OP='INSERT' THEN ids:=ARRAY[NEW.id]; ELSE ids:=ARRAY[OLD.id,NEW.id]; END IF;
  ELSE
    IF TG_OP='DELETE' THEN ids:=ARRAY[OLD.order_id];
    ELSIF TG_OP='INSERT' THEN ids:=ARRAY[NEW.order_id]; ELSE ids:=ARRAY[OLD.order_id,NEW.order_id]; END IF;
  END IF;
  FOREACH target IN ARRAY ids LOOP
    SELECT created_at,product_kind INTO stamp,kind FROM app.orders WHERE id=target;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT count(*),count(photo_asset_id) INTO slots,photos FROM app.order_beads WHERE order_id=target;
    IF NOT ((kind='necklace' AND slots=3) OR (kind='bracelet' AND slots=7)) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Product layout count mismatch';
    END IF;
    IF kind='necklace' THEN
      IF EXISTS(SELECT 1 FROM app.order_beads WHERE order_id=target AND
        (slot_index>2 OR photo_asset_id IS NOT NULL OR shape<>CASE WHEN slot_index=1 THEN 'moon' ELSE 'round' END)) THEN
        RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Necklace requires round moon round without photos';
      END IF;
    ELSIF EXISTS(SELECT 1 FROM app.order_beads WHERE order_id=target AND shape<>'square') THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Bracelet photo slots must be square';
    END IF;
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

CREATE FUNCTION app.check_order_checkout() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,app AS $$
DECLARE ids uuid[]; target uuid; stamp timestamptz; n integer; units integer; first_slot integer; last_slot integer;
BEGIN
  IF TG_TABLE_NAME='order_checkouts' THEN
    IF TG_OP='DELETE' THEN ids:=ARRAY[OLD.id];
    ELSIF TG_OP='INSERT' THEN ids:=ARRAY[NEW.id]; ELSE ids:=ARRAY[OLD.id,NEW.id]; END IF;
  ELSE
    IF TG_OP='DELETE' THEN ids:=ARRAY[OLD.checkout_id];
    ELSIF TG_OP='INSERT' THEN ids:=ARRAY[NEW.checkout_id]; ELSE ids:=ARRAY[OLD.checkout_id,NEW.checkout_id]; END IF;
  END IF;
  FOREACH target IN ARRAY ids LOOP
    IF target IS NULL THEN CONTINUE; END IF;
    SELECT created_at INTO stamp FROM app.order_checkouts WHERE id=target;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT count(*),COALESCE(sum(quantity),0),min(item_position),max(item_position)
      INTO n,units,first_slot,last_slot FROM app.orders WHERE checkout_id=target;
    IF n NOT BETWEEN 1 AND 20 OR units>100 OR first_slot<>0 OR last_slot<>n-1 THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Cart size quantity or positions invalid';
    END IF;
    IF EXISTS(SELECT 1 FROM app.orders WHERE checkout_id=target AND created_at<>stamp) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Cart receipt timestamp mismatch';
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION app.check_order_checkout() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER order_checkouts_complete AFTER INSERT OR UPDATE OR DELETE ON app.order_checkouts
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_order_checkout();
CREATE CONSTRAINT TRIGGER orders_checkout_complete AFTER INSERT OR UPDATE OR DELETE ON app.orders
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_order_checkout();
