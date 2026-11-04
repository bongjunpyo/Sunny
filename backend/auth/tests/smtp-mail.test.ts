import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { createServer as createTLSServer, createSecureContext, TLSSocket } from "node:tls";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { smtpConfig, smtpRequested } from "../../../frontend/lib/server/auth-smtp.ts";
import { sendVerificationEmail, sendPasswordResetEmail, verificationEmailConfigured } from "../../../frontend/lib/server/auth-email.ts";
import { createAuth } from "../../../frontend/lib/server/auth-core.ts";
import { handleAuth } from "../../../frontend/lib/server/auth-handler.ts";
import { createRuntimePool } from "../../../frontend/lib/server/postgres.ts";

const base = {
  NODE_ENV: "test", AUTH_DEV_LOCAL_MAIL: "false", BETTER_AUTH_URL: "http://localhost:4300",
  SMTP_HOST: "localhost", SMTP_PORT: "587", SMTP_USER: "team@example.invalid",
  SMTP_PASSWORD: "synthetic-smtp-password", AUTH_EMAIL_FROM: "Sunny <team@example.invalid>", RESEND_API_KEY: "",
};
const message = { email: "member@example.invalid", url: `${base.BETTER_AUTH_URL}/api/auth/verify-email?token=synthetic-only&callbackURL=%2Flogin` };

// The temporary CA is trusted only by this isolated child. No TLS verification bypass.
if (process.env.SUNNY_SMTP_TEST_WORKER !== "true") {
  test("SMTP configuration and real STARTTLS delivery (isolated temporary CA)", { timeout: 60000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), "sunny-smtp-"));
    try {
      for (const name of ["trusted", "untrusted"]) {
        execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
          "-subj", `/CN=${name}-sunny-test`, "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1",
          "-keyout", join(directory, `${name}.key`), "-out", join(directory, `${name}.crt`)], { stdio: "ignore" });
      }
      await new Promise<void>((resolve, reject) => {
        const env = { ...process.env, SUNNY_SMTP_TEST_WORKER: "true", SUNNY_SMTP_TEST_CERTS: directory,
          NODE_EXTRA_CA_CERTS: join(directory, "trusted.crt") };
        // node --test exports this internal marker; inheriting it would skip the child tests.
        delete env.NODE_TEST_CONTEXT;
        const child = spawn(process.execPath, ["--conditions=react-server", "--test", fileURLToPath(import.meta.url)], {
          env, stdio: ["ignore", "pipe", "pipe"],
        });
        let output = "";
        child.stdout.on("data", chunk => { output += chunk; });
        child.stderr.on("data", chunk => { output += chunk; });
        child.on("error", reject);
        child.on("exit", code => code === 0 ? (process.stdout.write(output), resolve()) : reject(new Error(output)));
      });
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
} else {
  Object.assign(process.env, base);

  /** Tiny local SMTP peer. It deliberately exposes AUTH before TLS to detect credential leaks. */
  async function smtpPeer(mode: "ok" | "implicit" | "no-tls" | "auth-fail" | "reject" | "data-fail" | "untrusted" = "ok") {
    const certName = mode === "untrusted" ? "untrusted" : "trusted";
    const credentials = {
      key: await readFile(join(process.env.SUNNY_SMTP_TEST_CERTS!, `${certName}.key`)),
      cert: await readFile(join(process.env.SUNNY_SMTP_TEST_CERTS!, `${certName}.crt`)),
    };
    const context = createSecureContext(credentials);
    const sockets = new Set<Socket>();
    const messages: string[] = []; const commands: string[] = [];
    let plaintextAuth = 0; let securedAuth = 0;
    function attach(socket: Socket, secured: boolean) {
      sockets.add(socket); socket.on("close", () => sockets.delete(socket));
      socket.on("error", () => {});
      let buffer = ""; let data: string[] | null = null;
      socket.on("data", chunk => {
        buffer += chunk.toString();
        let end: number;
        while ((end = buffer.indexOf("\r\n")) >= 0) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          if (data) {
            if (line === ".") {
              if (mode === "data-fail") socket.write("451 synthetic delivery failure\r\n");
              else { messages.push(data.join("\r\n")); socket.write("250 queued\r\n"); }
              data = null;
            } else data.push(line.startsWith("..") ? line.slice(1) : line);
            continue;
          }
          const command = line.split(" ", 1)[0]; commands.push(command);
          if (command === "EHLO") socket.write(`250-localhost\r\n${!secured && mode !== "no-tls" ? "250-STARTTLS\r\n" : ""}250 AUTH PLAIN\r\n`);
          else if (command === "STARTTLS") {
            if (mode === "no-tls") { socket.write("454 TLS unavailable\r\n"); continue; }
            socket.write("220 Begin TLS\r\n"); socket.removeAllListeners("data");
            attach(new TLSSocket(socket, { isServer: true, secureContext: context }), true); return;
          } else if (command === "AUTH") {
            if (secured) securedAuth++; else plaintextAuth++;
            const credentials = Buffer.from(line.split(" ")[2] ?? "", "base64").toString().split("\0");
            const valid = credentials.at(-2) === base.SMTP_USER && credentials.at(-1) === base.SMTP_PASSWORD;
            socket.write(mode === "auth-fail" || !valid ? "535 synthetic authentication failure\r\n" : "235 Authenticated\r\n");
          } else if (command === "MAIL") socket.write("250 Sender accepted\r\n");
          else if (command === "RCPT") socket.write(mode === "reject" ? "550 synthetic recipient rejected\r\n" : "250 Recipient accepted\r\n");
          else if (command === "DATA") { data = []; socket.write("354 Send message\r\n"); }
          else if (command === "QUIT") socket.end("221 Bye\r\n");
          else socket.write("250 OK\r\n");
        }
      });
    }
    const onConnect = (socket: Socket) => { attach(socket, mode === "implicit"); socket.write("220 localhost SMTP test\r\n"); };
    const server = mode === "implicit" ? createTLSServer(credentials, onConnect) : createServer(onConnect);
    server.on("tlsClientError", () => {});
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String((server.address() as { port: number }).port);
    return { messages, commands, stats: () => ({ plaintextAuth, securedAuth }), close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    } };
  }

  test("complete configuration requires TLS, strict certificate validation and private mail options", () => {
    const starttls = smtpConfig(base)!;
    assert.equal(starttls.secure, false); assert.equal(starttls.requireTLS, true);
    assert.equal(starttls.tls?.rejectUnauthorized, true); assert.equal(starttls.tls?.minVersion, "TLSv1.2");
    assert.equal(starttls.disableFileAccess, true); assert.equal(starttls.disableUrlAccess, true);
    assert.equal(starttls.logger, false); assert.equal(starttls.debug, false);
    assert.equal(smtpConfig({ ...base, SMTP_PORT: "465" })?.secure, true);
    assert.equal(smtpConfig({ ...base, SMTP_PORT: "" })?.port, 587);
    for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "AUTH_EMAIL_FROM"]) {
      assert.equal(smtpConfig({ ...base, [key]: "" }), null, key);
    }
    for (const port of ["0", "65536", "587junk", "587.5", "-1"]) assert.equal(smtpConfig({ ...base, SMTP_PORT: port }), null);
    for (const from of ["bad", "a@example.invalid,b@example.invalid", "a@example.invalid\r\nBcc: b@example.invalid"]) {
      assert.equal(smtpConfig({ ...base, AUTH_EMAIL_FROM: from }), null);
    }
    assert.equal(smtpConfig({ ...base, SMTP_HOST: "smtp://example.invalid" }), null);
    assert.equal(smtpRequested({ SMTP_PASSWORD: "partial" }), true);
    assert.equal(smtpRequested({ SMTP_HOST: "", SMTP_PORT: "", SMTP_USER: "", SMTP_PASSWORD: "" }), false);
  });

  test("partial SMTP blocks readiness even when the legacy provider has credentials; local mail is explicit", () => {
    Object.assign(process.env, base, { SMTP_PASSWORD: "", RESEND_API_KEY: "synthetic-legacy-key" });
    assert.equal(verificationEmailConfigured(), false);
    Object.assign(process.env, { NODE_ENV: "development", AUTH_DEV_LOCAL_MAIL: "true" });
    assert.equal(verificationEmailConfigured(), true);
    Object.assign(process.env, { NODE_ENV: "production" });
    assert.equal(verificationEmailConfigured(), false);
    Object.assign(process.env, base);
  });

  test("STARTTLS authenticates only after encryption and delivers one Korean multipart verification email", async () => {
    const peer = await smtpPeer();
    try {
      assert.equal(verificationEmailConfigured(), true);
      await sendVerificationEmail(message);
      assert.deepEqual(peer.stats(), { plaintextAuth: 0, securedAuth: 1 });
      assert.equal(peer.messages.length, 1);
      const mime = peer.messages[0];
      assert.match(mime, /From: Sunny <team@example.invalid>/);
      assert.match(mime, /To: member@example.invalid/);
      assert.match(mime, /multipart\/alternative/);
      assert.match(mime, /text\/plain; charset=utf-8/); assert.match(mime, /text\/html; charset=utf-8/);
      assert.equal(mime.includes(base.SMTP_PASSWORD), false);
      assert.match(mime, /synthetic-only/);
    } finally { await peer.close(); }
  });

  test("465 selects implicit TLS and successfully delivers over a real TLS socket", async t => {
    const peer = await smtpPeer("implicit");
    const testPort = Number(process.env.SMTP_PORT);
    const { default: nodemailer } = await import(new URL("../../../frontend/node_modules/nodemailer/dist/esm/nodemailer.js", import.meta.url).href);
    const original = nodemailer.createTransport;
    // Route the configured 465 transport to an ephemeral port, without changing any TLS option.
    t.mock.method(nodemailer, "createTransport", (options: Record<string, unknown>) => {
      assert.equal(options.port, 465); assert.equal(options.secure, true);
      return original({ ...options, port: testPort });
    });
    process.env.SMTP_PORT = "465";
    try {
      await sendVerificationEmail(message);
      assert.equal(peer.messages.length, 1); assert.deepEqual(peer.stats(), { plaintextAuth: 0, securedAuth: 1 });
      assert.equal(peer.commands.includes("STARTTLS"), false);
    } finally { await peer.close(); }
  });

  test("legacy API delivery remains available only when SMTP is entirely absent", async t => {
    Object.assign(process.env, base, { SMTP_HOST: "", SMTP_PORT: "", SMTP_USER: "", SMTP_PASSWORD: "", RESEND_API_KEY: "synthetic-legacy" });
    const fetchMock = t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
      assert.equal(url, "https://api.resend.com/emails");
      assert.deepEqual(JSON.parse(String(init.body)).to, [message.email]);
      return Response.json({ id: "synthetic-delivery" });
    });
    try {
      assert.equal(verificationEmailConfigured(), true); await sendVerificationEmail(message);
      assert.equal(fetchMock.mock.calls.length, 1);
    } finally { Object.assign(process.env, base); }
  });

  for (const mode of ["no-tls", "auth-fail", "reject", "data-fail", "untrusted"] as const) {
    test(`${mode} fails safely without plaintext credentials or fallback delivery`, async t => {
      const peer = await smtpPeer(mode);
      const fetchMock = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected provider fallback"); });
      try {
        await assert.rejects(sendVerificationEmail(message), { message: "Verification email delivery failed" });
        assert.equal(peer.stats().plaintextAuth, 0); assert.equal(peer.messages.length, 0);
        if (["no-tls", "untrusted"].includes(mode)) assert.equal(peer.stats().securedAuth, 0);
        assert.equal(fetchMock.mock.calls.length, 0);
      } finally { await peer.close(); }
    });
  }

  test("invalid verification origin, missing token and multi-recipient input never start SMTP", async () => {
    const peer = await smtpPeer();
    try {
      for (const url of ["https://evil.invalid/api/auth/verify-email?token=synthetic", `${base.BETTER_AUTH_URL}/api/auth/verify-email`,
        `${base.BETTER_AUTH_URL}/other?token=synthetic`, `${message.url}#fragment`]) {
        await assert.rejects(sendVerificationEmail({ ...message, url }));
      }
      await assert.rejects(sendVerificationEmail({ ...message, email: "a@example.invalid,b@example.invalid" }));
      assert.equal(peer.commands.length, 0);
    } finally { await peer.close(); }
  });

  // Only an explicitly supplied disposable DB is used; the normal developer env file is never loaded.
  if (process.env.SUNNY_SMTP_TEST_DATABASE) {
    test("PostgreSQL signup sends no mail; reset delivers SMTP link, changes password and revokes sessions", async () => {
      const database = new URL(process.env.SUNNY_SMTP_TEST_DATABASE!);
      assert.equal(database.hostname, "127.0.0.1"); assert.equal(database.pathname, "/sunny"); assert.equal(database.username, "sunny_auth");
      const pool = createRuntimePool(database.href, "sunny_auth");
      const prefix = `smtp-it-${randomUUID()}`; const email = `${prefix}@example.invalid`;
      const password = "Synthetic-SMTP-Old-114!", replacement = "Synthetic-SMTP-New-114!";
      const auth = createAuth(pool, { baseURL: base.BETTER_AUTH_URL, secret: randomBytes(48).toString("base64url"), resetMailer: sendPasswordResetEmail });
      let sequence = 0;
      const call = (path: string, body?: unknown, cookie?: string) => handleAuth(new Request(`${base.BETTER_AUTH_URL}/api/auth/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { origin: base.BETTER_AUTH_URL, "content-type": "application/json", "x-forwarded-for": `192.0.2.${++sequence}`, ...(cookie ? { cookie } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }), auth, { baseURL: base.BETTER_AUTH_URL, emailReady: verificationEmailConfigured() });
      let peer = await smtpPeer();
      try {
        process.env.SMTP_PASSWORD = "";
        const signup = await call("sign-up/email", { name: "SMTPTest", email, password });
        assert.equal(signup.status, 200); assert.equal(signup.headers.getSetCookie().length, 0);
        assert.deepEqual(await signup.json(), { registered: true, message: "가입을 완료했습니다. 로그인해 주세요." });
        assert.equal((await pool.query('SELECT "emailVerified" FROM auth."user" WHERE email=$1', [email])).rows[0].emailVerified, false);
        assert.equal(peer.messages.length, 0);
        const login = await call("sign-in/email", { email, password }); assert.equal(login.status, 200);
        const cookie = login.headers.getSetCookie().map(value => value.split(";", 1)[0]).join("; ");
        assert.equal((await call("request-password-reset", { email })).status, 503);
        process.env.SMTP_PASSWORD = base.SMTP_PASSWORD;
        const resetRequest = await call("request-password-reset", { email }); assert.equal(resetRequest.status, 200);
        assert.equal(peer.messages.length, 1);
        const mime = peer.messages[0].replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        const link = mime.match(/href="([^"]+)"/)?.[1].replaceAll("&amp;", "&"); assert.ok(link);
        const target = new URL(link); assert.equal(target.pathname, "/reset-password"); assert.equal(target.search, "");
        const token = new URLSearchParams(target.hash.slice(1)).get("token"); assert.ok(token);
        const reset = await call("reset-password", { token, newPassword: replacement }); assert.equal(reset.status, 200);
        assert.deepEqual(await reset.json(), { success: true }); assert.equal(reset.headers.getSetCookie().length, 0);
        assert.equal(await (await call("get-session", undefined, cookie)).json(), null);
        assert.equal((await call("sign-in/email", { email, password })).status, 401);
        assert.equal((await call("sign-in/email", { email, password: replacement })).status, 200);
        assert.equal((await call("reset-password", { token, newPassword: password })).status, 400);
        await peer.close(); peer = await smtpPeer("data-fail");
        const failed = await call("request-password-reset", { email }); assert.equal(failed.status, 503);
        const text = JSON.stringify(await failed.json()); assert.match(text, /AUTH_EMAIL_UNAVAILABLE/);
        for(const value of [email, password, base.SMTP_PASSWORD, token]) assert.equal(text.includes(value), false);
      } finally {
        await peer.close();
        await pool.query('DELETE FROM auth.verification WHERE value IN (SELECT id::text FROM auth."user" WHERE email=$1)', [email]);
        await pool.query('DELETE FROM auth."user" WHERE email=$1', [email]); await pool.end();
      }
    });
  }
}
