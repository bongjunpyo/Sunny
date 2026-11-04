import "server-only";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { withUserTransaction } from "../postgres.ts";
import { UploadError, uploadPolicy, type PresignInput, type UploadErrorCode } from "./policy.ts";
import type { InspectedPhoto } from "./image.ts";

export type PhotoAsset = { id: string; owner_id: string; purpose: string; status: string; declared_mime: string;
  pending_key: string; complete_expires_at: Date; inspection_token: string | null; inspection_expires_at: Date | null;
  verified_key: string | null; mime_type: string | null; bytes: number | null; width: number | null; height: number | null;
  rejection_code: UploadErrorCode | null; access_blocked_at: Date | null };
export function photoResult(asset: PhotoAsset) {
  return { assetId: asset.id, status: "verified" as const, mimeType: asset.mime_type!, bytes: asset.bytes!, width: asset.width!, height: asset.height! };
}
export function createPhotoRepository(pool: Pool) {
  return {
    async presign(owner: string, input: PresignInput, sign: (key: string, mime: string, date: Date) => Promise<string>) {
      return withUserTransaction(pool, owner, async db => {
        // Same-user requests serialize across instances, not just in one Node process.
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 93))", [owner]);
        const { rows: [clock] } = await db.query("SELECT clock_timestamp() AS now");
        const now: Date = clock.now;
        const recent = await db.query(`SELECT created_at FROM app.photo_assets WHERE owner_id=$1
          AND created_at > $2::timestamptz - interval '60 minutes' ORDER BY created_at`, [owner, now]);
        if (recent.rowCount! >= 20) throw new UploadError("UPLOAD_RATE_LIMITED",
          Math.max(1, Math.ceil((recent.rows[0].created_at.getTime() + 3600000 - now.getTime()) / 1000)));
        const id = randomUUID(), key = `pending/${randomUUID()}`;
        const expiresAt = new Date(now.getTime() + uploadPolicy.putSeconds * 1000);
        const uploadUrl = await sign(key, input.mimeType, now);
        await db.query(`INSERT INTO app.photo_assets (id,owner_id,purpose,declared_mime,declared_bytes,pending_key,
          created_at,put_expires_at,complete_expires_at,pending_cleanup_after) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, owner, input.purpose, input.mimeType, input.size, key, now, expiresAt,
            new Date(now.getTime() + uploadPolicy.completeSeconds * 1000),
            new Date(expiresAt.getTime() + uploadPolicy.completeSeconds * 1000)]);
        return { assetId: id, uploadUrl, expiresAt: expiresAt.toISOString() };
      });
    },
    async get(owner: string, id: string) {
      return withUserTransaction(pool, owner, async db => {
        const { rows } = await db.query<PhotoAsset>("SELECT * FROM app.photo_assets WHERE id=$1 AND owner_id=$2", [id, owner]);
        if (!rows[0] || rows[0].access_blocked_at) throw new UploadError("UPLOAD_NOT_FOUND");
        return rows[0];
      });
    },
    async claim(owner: string, id: string) {
      // Return expired then throw outside the transaction: the expiry transition must commit.
      return withUserTransaction(pool, owner, async db => {
        const { rows: [asset] } = await db.query<PhotoAsset>("SELECT * FROM app.photo_assets WHERE id=$1 AND owner_id=$2 FOR UPDATE", [id, owner]);
        if (!asset || asset.access_blocked_at) throw new UploadError("UPLOAD_NOT_FOUND");
        if (["verified", "rejected", "expired"].includes(asset.status)) return { asset, claimed: false };
        const { rows: [clock] } = await db.query("SELECT clock_timestamp() AS now");
        const now: Date = clock.now;
        if (asset.status === "inspecting" && asset.inspection_expires_at! > now) {
          throw new UploadError("UPLOAD_INSPECTION_IN_PROGRESS", 3);
        }
        if (asset.complete_expires_at <= now) {
          const { rows: [expired] } = await db.query<PhotoAsset>(`UPDATE app.photo_assets SET status='expired',
            inspection_token=NULL,inspection_expires_at=NULL WHERE id=$1 RETURNING *`, [id]);
          return { asset: expired, claimed: false };
        }
        const token = randomUUID(), key = `verified/${token}`;
        const { rows: [claimed] } = await db.query<PhotoAsset>(`UPDATE app.photo_assets SET status='inspecting',
          inspection_token=$2, inspection_expires_at=$3 WHERE id=$1 RETURNING *`, [id, token,
          new Date(now.getTime() + uploadPolicy.leaseSeconds * 1000)]);
        await db.query(`INSERT INTO app.photo_upload_attempts(id,asset_id,owner_id,object_key) VALUES ($1,$2,$3,$4)`, [token, id, owner, key]);
        return { asset: claimed, claimed: true };
      });
    },
    async finish(owner: string, id: string, token: string, photo: InspectedPhoto) {
      return withUserTransaction(pool, owner, async db => {
        const { rows: [asset] } = await db.query<PhotoAsset>(`UPDATE app.photo_assets SET status='verified',
          verified_key=$4,mime_type=$5,bytes=$6,width=$7,height=$8,sha256=$9,inspection_token=NULL,inspection_expires_at=NULL
          WHERE id=$1 AND owner_id=$2 AND inspection_token=$3 AND status='inspecting'
          AND inspection_expires_at > clock_timestamp() AND access_blocked_at IS NULL RETURNING *`,
          [id, owner, token, `verified/${token}`, photo.mimeType, photo.bytes, photo.width, photo.height, photo.sha256]);
        if (!asset) throw new UploadError("UPLOAD_STORAGE_UNAVAILABLE");
        await db.query("UPDATE app.photo_upload_attempts SET published_at=clock_timestamp() WHERE id=$1 AND owner_id=$2", [token, owner]);
        return asset;
      });
    },
    async fail(owner: string, id: string, token: string, rejection?: UploadErrorCode) {
      return withUserTransaction(pool, owner, async db => {
        await db.query(`UPDATE app.photo_assets SET status=$4,rejection_code=$5,inspection_token=NULL,inspection_expires_at=NULL
          WHERE id=$1 AND owner_id=$2 AND inspection_token=$3 AND status='inspecting'`,
          [id, owner, token, rejection ? "rejected" : "pending", rejection ?? null]);
      });
    },
  };
}
export type PhotoRepository = ReturnType<typeof createPhotoRepository>;
