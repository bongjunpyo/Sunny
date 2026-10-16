// Explicit opt-in: real R2 network I/O, synthetic images only. No R2/DB deletion.
// Node 24, repository root: SUNNY_LIVE_R2_VERIFY=1 node backend/uploads/tests/live-r2.mjs
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = new URL("../../../", import.meta.url);
const require = createRequire(new URL("frontend/package.json", root));
const { Pool } = require("pg"), sharp = require("sharp");
let pool, phase = "explicit opt-in", directory;
const runId = randomUUID(), subjects = [], assets = [], checks = [];
const check = (value, label) => { if (!value) throw new Error(label); };
const digest = data => createHash("sha256").update(data).digest("hex");
const retain = async () => {
  if (directory) await writeFile(join(directory, "manifest.json"), JSON.stringify({ runId, subjects, assets, checks }, null, 2), { mode: 0o600 });
};
const pass = label => { checks.push(label); console.log(`PASS: ${label}`); };
const jar = response => response.headers.getSetCookie().map(c => c.split(";", 1)[0]).join("; ");
try {
  check(process.env.SUNNY_LIVE_R2_VERIFY === "1", "Opt-in required");
  const app = parseEnv(await readFile(new URL("frontend/.env.local", root), "utf8"));
  const db = parseEnv(await readFile(new URL("backend/.env.local", root), "utf8"));
  const base = new URL(app.BETTER_AUTH_URL);
  check(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "Loopback required");
  check(app.AUTH_ENABLED === "true" && app.PHOTO_UPLOAD_ENABLED === "true" && app.AUTH_DEV_LOCAL_MAIL === "true", "Local flags required");
  check(/^[a-f0-9]{32}$/.test(app.R2_ACCOUNT_ID || "") && app.R2_BUCKET_NAME && app.R2_ACCESS_KEY_ID && app.R2_SECRET_ACCESS_KEY, "R2 configuration required");
  check(/^\d+$/.test(db.SUNNY_PG_PORT || "5434"), "Invalid local port");
  directory = join(tmpdir(), `sunny-live-r2-${runId}`); await mkdir(directory, { mode: 0o700 });
  pool = new Pool({ connectionString: `postgresql://sunny_admin:${encodeURIComponent(db.SUNNY_PG_ADMIN_PASSWORD)}@127.0.0.1:${db.SUNNY_PG_PORT || 5434}/sunny`, max: 1 });
  const { rows: [identity] } = await pool.query("SELECT current_database() AS db,session_user AS role");
  check(identity.db === "sunny" && identity.role === "sunny_admin", "Local DB identity required");
  const call = (path, cookie, body, method = "POST") => fetch(new URL(path, base), { method, redirect: "manual", signal: AbortSignal.timeout(60000),
    headers: { Origin: base.origin, ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const json = async (response, status) => {
    check(response.status === status, `Unexpected HTTP ${response.status}`);
    check(response.headers.get("cache-control") === "no-store", "App no-store missing");
    return response.json();
  };
  const getAsset = async id => (await pool.query("SELECT * FROM app.photo_assets WHERE id=$1", [id])).rows[0];
  const validateR2 = raw => {
    const url = new URL(raw), suffix = `${app.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    check(url.protocol === "https:" && (url.hostname === suffix || url.hostname.endsWith(`.${suffix}`)), "Unexpected R2 endpoint");
    return url;
  };
  const r2 = (url, options = {}) => fetch(validateR2(url), { ...options, redirect: "error", credentials: "omit", signal: AbortSignal.timeout(30000) });
  const acceptR2 = async (response, label) => {
    if (response.ok) return;
    // R2 errors can contain signing details. Extract only the fixed XML error code.
    const code = (await response.text()).match(/<Code>([A-Za-z0-9]{1,60})<\/Code>/)?.[1] || "UnknownError";
    throw new Error(`${label} HTTP ${response.status} ${code}`);
  };
  const cors = response => check(response.headers.get("access-control-allow-origin") === base.origin, "CORS Origin missing");
  const preflight = async (url, method) => {
    const response = await r2(url, { method: "OPTIONS", headers: { Origin: base.origin, "Access-Control-Request-Method": method,
      ...(method === "PUT" ? { "Access-Control-Request-Headers": "content-type" } : {}) } });
    check(response.ok, `CORS preflight HTTP ${response.status}`); cors(response);
    check(response.headers.get("access-control-allow-methods")?.split(/\s*,\s*/).includes(method), "CORS method missing");
    if (method === "PUT") check(response.headers.get("access-control-allow-headers")?.toLowerCase().includes("content-type"), "CORS header missing");
    await response.body?.cancel();
  };
  phase = "new synthetic guest DB session";
  const guestResponse = await call("/api/auth/sign-in/anonymous", undefined, {});
  const guestDTO = await json(guestResponse, 200), guest = { id: guestDTO.user.id, cookie: jar(guestResponse) };
  subjects.push({ id: guest.id, kind: "synthetic-guest" }); await retain();
  check(guestDTO.user.isAnonymous === true && guest.cookie, "Guest session missing");
  pass("actual Next HTTP guest session created");

  phase = "new synthetic member signup and local email verification";
  const mailbox = new URL("frontend/.sunny-auth-mail/", root);
  const before = new Set(await readdir(mailbox).catch(() => []));
  const email = `r2-live-${runId}@example.invalid`, password = `Synthetic1!${randomBytes(18).toString("base64url")}`;
  const signup = await json(await call("/api/auth/sign-up/email", undefined, { name: "R2Proof", email, password }), 200);
  check(signup.verificationDelivery === "local", "Must not send real mail");
  const { rows: [memberRow] } = await pool.query('SELECT id FROM auth."user" WHERE email=$1', [email]);
  check(memberRow?.id, "Member DB persistence missing"); subjects.push({ id: memberRow.id, kind: "synthetic-member" }); await retain();
  let verification;
  for (const file of (await readdir(mailbox)).filter(name => !before.has(name) && name.endsWith(".txt"))) {
    const text = await readFile(new URL(file, mailbox), "utf8");
    if (text.includes(email)) verification = text.split(/\r?\n/).find(line => line.startsWith(`${base.origin}/api/auth/verify-email?`));
  }
  check(verification, "New synthetic verification link missing");
  const verified = await fetch(verification, { redirect: "manual", signal: AbortSignal.timeout(30000) });
  check(verified.status === 303 && verified.headers.get("location") === `${base.origin}/login?auth=email-verified`, "Synthetic verification failed");
  const login = await call("/api/auth/sign-in/email", undefined, { email, password });
  const memberDTO = await json(login, 200), member = { id: memberDTO.user.id, cookie: jar(login) };
  check(member.id === memberRow.id && memberDTO.user.isAnonymous === false, "Member session mismatch");
  pass("actual Next HTTP synthetic member verified and logged in");

  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1000"><rect width="1200" height="1000" fill="#88aacb"/></svg>');
  const png = await sharp(svg).png().toBuffer();
  const jpeg = await sharp(svg).jpeg().withMetadata({ orientation: 6, exif: { IFD0: { Artist: "Synthetic R2 verification only" } } }).toBuffer();
  const runs = [{ name: "member-jpeg", who: member, data: jpeg, mime: "image/jpeg", width: 1000, height: 1200 },
    { name: "guest-png", who: guest, data: png, mime: "image/png", width: 1200, height: 1000 }];
  for (const item of runs) {
    phase = `${item.name} presign / pending DB row`;
    const signed = await json(await call("/api/uploads/presign", item.who.cookie,
      { purpose: "custom_order_photo", fileName: `${item.name}.synthetic`, mimeType: item.mime, size: item.data.length }), 201);
    assets.push({ id: signed.assetId, ownerId: item.who.id, name: item.name }); await retain();
    const pending = await getAsset(signed.assetId);
    check(pending?.status === "pending" && pending.owner_id === item.who.id, "Pending DB ownership mismatch");
    check(!pending.verified_key && pending.declared_mime === item.mime, "Unexpected pending metadata");
    phase = `${item.name} actual R2 CORS / PUT`;
    await preflight(signed.uploadUrl, "PUT");
    const put = await r2(signed.uploadUrl, { method: "PUT", headers: { Origin: base.origin, "Content-Type": item.mime }, body: item.data });
    await acceptR2(put, "R2 PUT"); cors(put); await put.body?.cancel();
    pass(`${item.name}: R2 PUT and HTTP CORS preflight succeeded`);
    phase = `${item.name} server inspection / verified DB metadata`;
    const completed = await json(await call(`/api/uploads/${signed.assetId}/complete`, item.who.cookie), 200);
    check(completed.status === "verified" && completed.mimeType === item.mime && completed.width === item.width && completed.height === item.height, "Inspection DTO mismatch");
    const row = await getAsset(signed.assetId);
    check(row.status === "verified" && row.owner_id === item.who.id && row.verified_key !== row.pending_key && row.verified_key?.startsWith("verified/"), "Verified DB mismatch");
    const { rows: [attempt] } = await pool.query("SELECT published_at FROM app.photo_upload_attempts WHERE asset_id=$1 AND object_key=$2", [signed.assetId, row.verified_key]);
    check(attempt?.published_at && row.bytes === completed.bytes && row.width === completed.width && row.height === completed.height, "Published inspection metadata missing");
    phase = `${item.name} signed GET / bytes / EXIF`;
    const read = await json(await call(`/api/uploads/${signed.assetId}/read-url`, item.who.cookie), 200);
    await preflight(read.readUrl, "GET");
    const result = await r2(read.readUrl, { headers: { Origin: base.origin } });
    await acceptR2(result, "R2 GET"); cors(result);
    check(result.headers.get("cache-control")?.includes("no-store"), "Object no-store missing");
    const bytes = Buffer.from(await result.arrayBuffer()), metadata = await sharp(bytes).metadata();
    check(bytes.length === row.bytes && digest(bytes) === row.sha256 && metadata.width === row.width && metadata.height === row.height, "Downloaded object does not match DB");
    for (const field of ["exif", "orientation", "xmp", "iptc", "icc"]) check(metadata[field] === undefined, "Private image metadata survived");
    await writeFile(join(directory, `${item.name}.${item.mime === "image/png" ? "png" : "jpg"}`), bytes, { mode: 0o600 });
    const unsigned = new URL(read.readUrl); unsigned.search = "";
    const privateRead = await r2(unsigned); check([401, 403].includes(privateRead.status), `Unsigned access HTTP ${privateRead.status}`); await privateRead.body?.cancel();
    const again = await json(await call(`/api/uploads/${signed.assetId}/complete`, item.who.cookie), 200);
    check(JSON.stringify(again) === JSON.stringify(completed), "Complete idempotency failed");
    const reloadSession = await json(await call("/api/auth/get-session", item.who.cookie, undefined, "GET"), 200);
    check(reloadSession.user.id === item.who.id, "Session re-query failed");
    const freshRead = await json(await call(`/api/uploads/${signed.assetId}/read-url`, item.who.cookie), 200);
    const freshObject = await r2(freshRead.readUrl); check(freshObject.ok && digest(Buffer.from(await freshObject.arrayBuffer())) === row.sha256, "Reissued read URL changed object");
    pass(`${item.name}: server inspection, DB publication, signed GET hash, EXIF removal, private access, idempotency and session re-query succeeded`);
    if (item.who === guest) {
      phase = "pending PUT reuse cannot change the verified object";
      const overwrite = await r2(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": item.mime }, body: svg });
      await acceptR2(overwrite, "Pending overwrite"); await overwrite.body?.cancel();
      const unchanged = await r2(freshRead.readUrl);
      check(unchanged.ok && digest(Buffer.from(await unchanged.arrayBuffer())) === row.sha256, "Verified object changed after pending overwrite");
      pass("reused real R2 pending PUT does not alter the verified photo");
    }
  }
  phase = "cross-user and no-session read denied";
  const guestAsset = assets.find(a => a.name === "guest-png");
  check((await json(await call(`/api/uploads/${guestAsset.id}/read-url`, member.cookie), 404)).error.code === "UPLOAD_NOT_FOUND", "Cross-user access allowed");
  check((await json(await call(`/api/uploads/${guestAsset.id}/read-url`), 401)).error.code === "AUTHENTICATION_REQUIRED", "Anonymous access allowed");
  pass("cross-user and unauthenticated URL issuance denied");
  phase = "server rejects a real uploaded SVG with PNG MIME";
  const invalid = await json(await call("/api/uploads/presign", guest.cookie,
    { purpose: "custom_order_photo", fileName: "synthetic-spoof.png", mimeType: "image/png", size: svg.length }), 201);
  assets.push({ id: invalid.assetId, ownerId: guest.id, name: "rejected-svg" }); await retain();
  const invalidPut = await r2(invalid.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: svg });
  await acceptR2(invalidPut, "Spoof PUT"); await invalidPut.body?.cancel();
  check((await json(await call(`/api/uploads/${invalid.assetId}/complete`, guest.cookie), 415)).error.code === "UNSUPPORTED_IMAGE_TYPE", "SVG accepted");
  const rejected = await getAsset(invalid.assetId);
  check(rejected.status === "rejected" && !rejected.verified_key, "Rejected state missing");
  check((await json(await call(`/api/uploads/${invalid.assetId}/read-url`, guest.cookie), 409)).error.code === "UPLOAD_NOT_VERIFIED", "Rejected photo readable");
  pass("actual uploaded MIME-spoofed SVG rejected; DB rejected and no read URL");
  phase = "logout denies fresh URL issuance";
  await json(await call("/api/auth/sign-out", guest.cookie, {}), 200);
  check((await json(await call(`/api/uploads/${guestAsset.id}/read-url`, guest.cookie), 401)).error.code === "AUTHENTICATION_REQUIRED", "Logged-out session allowed");
  await json(await call("/api/auth/sign-out", member.cookie, {}), 200);
  pass("logged-out DB session cannot issue new photo URLs");
  await retain();
  const summary = { completedAt: new Date().toISOString(), runId, verified: 2, rejected: 1, checks,
    retainedSyntheticSubjects: subjects.length, retainedSyntheticAssets: assets.length, r2ObjectsDeleted: false,
    browserUploadAnd3DTested: false, urlsOrCredentialsRecorded: false };
  await writeFile(join(directory, "summary.json"), JSON.stringify(summary, null, 2), { mode: 0o600 });
  console.log("PASS: real Next HTTP -> R2 PUT -> server inspection -> PostgreSQL -> signed R2 GET.");
  console.log("Retained: two synthetic subjects, three photo assets, five R2 objects. No object/DB deletion. Browser/3D flow not tested.");
  console.log(`Private verification artifacts: ${directory}`);
} catch (error) {
  // Never print raw fetch/SDK/SQL errors, signatures, cookies, credentials or real identities.
  await retain().catch(() => {});
  const safeReason = typeof error?.message === "string" && /^[A-Za-z0-9 /:.,_-]{1,100}$/.test(error.message) ? error.message : "details suppressed";
  console.error(`FAIL: ${phase}; ${safeReason}`); process.exitCode = 1;
} finally { await pool?.end(); }
