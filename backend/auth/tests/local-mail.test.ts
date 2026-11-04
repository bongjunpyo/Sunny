import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, stat, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localVerificationMailEnabled, saveLocalVerificationMail } from "../../../frontend/lib/server/auth-local-mail.ts";

test("local mail requires explicit development flag and loopback origin; production is always excluded", () => {
  const env = { NODE_ENV: "development", AUTH_DEV_LOCAL_MAIL: "true", BETTER_AUTH_URL: "http://localhost:3000" };
  assert.equal(localVerificationMailEnabled(env), true);
  for (const overrides of [{ NODE_ENV: "production" }, { NODE_ENV: "test" }, { AUTH_DEV_LOCAL_MAIL: "false" },
    { BETTER_AUTH_URL: "https://sunny.example" }, { BETTER_AUTH_URL: "http://localhost.attacker.invalid" }, { BETTER_AUTH_URL: "invalid" }]) {
    assert.equal(localVerificationMailEnabled({ ...env, ...overrides }), false);
  }
});

test("local verification files have private permissions, escape HTML, reject remote links and symlink mailbox", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sunny-mail-test-"));
  const originalCwd = process.cwd();
  const originalEnv = { NODE_ENV: process.env.NODE_ENV, AUTH_DEV_LOCAL_MAIL: process.env.AUTH_DEV_LOCAL_MAIL, BETTER_AUTH_URL: process.env.BETTER_AUTH_URL };
  try {
    process.chdir(directory); Object.assign(process.env, { NODE_ENV: "development", AUTH_DEV_LOCAL_MAIL: "true", BETTER_AUTH_URL: "http://localhost:3000" });
    await saveLocalVerificationMail({ email: '<probe>@example.invalid', url: "http://localhost:3000/api/auth/verify-email?token=synthetic-test-only&callbackURL=%2Flogin" });
    const mailbox = join(directory, ".sunny-auth-mail"); const files = await readdir(mailbox);
    assert.equal(files.length, 2); const file = join(mailbox, files.find(name => name.endsWith(".html"))!);
    const textFile = join(mailbox, files.find(name => name.endsWith(".txt"))!);
    assert.equal((await stat(textFile)).mode & 0o777, 0o600);
    const text = await readFile(textFile, "utf8"); assert.ok(text.includes("&callbackURL=")); assert.equal(text.includes("&amp;"), false);
    assert.equal((await stat(mailbox)).mode & 0o777, 0o700); assert.equal((await stat(file)).mode & 0o777, 0o600);
    const html = await readFile(file, "utf8"); assert.ok(html.includes("&lt;probe&gt;")); assert.ok(html.includes('content="no-referrer"'));
    await assert.rejects(saveLocalVerificationMail({ email: "probe@example.invalid", url: "https://attacker.invalid/api/auth/verify-email" }));
    process.env.NODE_ENV = "production";
    await assert.rejects(saveLocalVerificationMail({ email: "probe@example.invalid", url: "http://localhost:3000/api/auth/verify-email" }));
    process.env.NODE_ENV = "development";
    await rm(mailbox, { recursive: true }); await symlink(tmpdir(), mailbox);
    await assert.rejects(saveLocalVerificationMail({ email: "probe@example.invalid", url: "http://localhost:3000/api/auth/verify-email" }));
  } finally {
    process.chdir(originalCwd);
    for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await rm(directory, { recursive: true, force: true });
  }
});
