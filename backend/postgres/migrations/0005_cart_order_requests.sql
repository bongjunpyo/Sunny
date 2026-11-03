-- Add cart checkout groups without rewriting any applied 0001-0004 SQL or legacy rows.
SET LOCAL ROLE sunny_owner;
SET LOCAL search_path=pg_catalog,app;
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
ALTER TABLE app.orders ADD COLUMN checkout_id uuid,
  ADD COLUMN item_position integer,
  ADD COLUMN quantity integer NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 10),
  ADD FOREIGN KEY(checkout_id,owner_id) REFERENCES app.order_checkouts(id,owner_id) ON DELETE RESTRICT,
  ADD CHECK((checkout_id IS NULL AND item_position IS NULL AND quantity=1)
    OR (checkout_id IS NOT NULL AND item_position IS NOT NULL AND item_position BETWEEN 0 AND 19));
CREATE UNIQUE INDEX orders_checkout_position ON app.orders(checkout_id,item_position) WHERE checkout_id IS NOT NULL;
CREATE INDEX orders_legacy_owner_page ON app.orders(owner_id,created_at DESC,id DESC) WHERE checkout_id IS NULL;
ALTER TABLE app.order_beads ADD COLUMN shape text NOT NULL DEFAULT 'square' CHECK(shape IN ('square','round','moon'));
ALTER TABLE app.order_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.order_checkouts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.order_checkouts FROM PUBLIC,sunny_auth,sunny_app;
GRANT SELECT,INSERT ON app.order_checkouts TO sunny_app;
CREATE POLICY order_checkouts_owner ON app.order_checkouts TO sunny_app
  USING(owner_id=nullif(current_setting('app.user_id',true),'')::uuid)
  WITH CHECK(owner_id=nullif(current_setting('app.user_id',true),'')::uuid);

CREATE OR REPLACE FUNCTION app.check_order_request() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,app AS $$
DECLARE ids uuid[]; target uuid; photos integer; slots integer; stamp timestamptz; kind text; checkout uuid;
BEGIN
  IF TG_TABLE_NAME='orders' THEN
    IF TG_OP='DELETE' THEN ids:=ARRAY[OLD.id];
    ELSIF TG_OP='INSERT' THEN ids:=ARRAY[NEW.id]; ELSE ids:=ARRAY[OLD.id,NEW.id]; END IF;
  ELSE
    IF TG_OP='DELETE' THEN ids:=ARRAY[OLD.order_id];
    ELSIF TG_OP='INSERT' THEN ids:=ARRAY[NEW.order_id]; ELSE ids:=ARRAY[OLD.order_id,NEW.order_id]; END IF;
  END IF;
  FOREACH target IN ARRAY ids LOOP
    SELECT created_at,product_kind,checkout_id INTO stamp,kind,checkout FROM app.orders WHERE id=target;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT count(*),count(photo_asset_id) INTO slots,photos FROM app.order_beads WHERE order_id=target;
    IF NOT ((checkout IS NOT NULL AND kind='necklace' AND slots=3)
      OR ((checkout IS NULL OR kind='bracelet') AND slots=7)) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Product layout count mismatch';
    END IF;
    IF checkout IS NOT NULL AND kind='necklace' THEN
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
