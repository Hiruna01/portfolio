import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { query } from "./db";
import { countAttempts, recordAttempt } from "./store";

// Single-admin login.
//   - The username and a scrypt hash of the password come from environment variables. There is no sign-up.
//   - A session is a random token. The browser holds it in an httpOnly cookie; the database holds only its hash,
//     so a leaked database cannot be used to sign in, and deleting the row signs the browser out.
//   - Failed logins are rate limited per IP address and overall.

const SESSION_HOURS = 8;
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-admin_session" : "admin_session";
const LOGIN_WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_IP = 5;
const MAX_FAILURES_OVERALL = 30;

// ---------- Password hashing ----------
// Stored format: scrypt:<log2 N>:<r>:<p>:<salt base64url>:<hash base64url>
// Colons rather than "$" so the value survives .env files untouched.

type Params = { N: number; r: number; p: number };

function derive(password: string, salt: Buffer, { N, r, p }: Params, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, length, { N, r, p, maxmem: 256 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const params = { N: 2 ** 15, r: 8, p: 1 };
  const key = await derive(password, salt, params, 32);
  return `scrypt:15:8:1:${salt.toString("base64url")}:${key.toString("base64url")}`;
}

async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, logN, r, p, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), { N: 2 ** Number(logN), r: Number(r), p: Number(p) }, expected.length);
  return timingSafeEqual(actual, expected);
}

// Compared against when the username is wrong or login is not configured, so every attempt costs the same time.
const DUMMY_HASH = "scrypt:15:8:1:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function sameText(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

// ---------- Request helpers ----------

export async function clientIp(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// ---------- Login ----------

export type LoginResult = "ok" | "invalid" | "locked" | "not-configured";

export async function logIn(username: string, password: string): Promise<LoginResult> {
  const adminUser = process.env.ADMIN_USERNAME;
  const adminHash = process.env.ADMIN_PASSWORD_HASH;
  const ip = await clientIp();
  const ipBucket = `login:${ip}`;

  const [byIp, overall] = await Promise.all([
    countAttempts(ipBucket, LOGIN_WINDOW_MINUTES),
    countAttempts("login:all", LOGIN_WINDOW_MINUTES),
  ]);
  if (byIp >= MAX_FAILURES_PER_IP || overall >= MAX_FAILURES_OVERALL) return "locked";

  // Always run the password check, even with a wrong username, so timing gives nothing away.
  const passwordOk = await checkPassword(password, adminHash || DUMMY_HASH).catch(() => false);
  const userOk = sameText(username, adminUser || "");

  if (!adminUser || !adminHash) return "not-configured";
  if (!passwordOk || !userOk) {
    await Promise.all([recordAttempt(ipBucket), recordAttempt("login:all")]);
    return "invalid";
  }

  const token = randomBytes(32).toString("base64url");
  await query(`DELETE FROM sessions WHERE expires_at < now()`);
  await query(`INSERT INTO sessions (token_hash, expires_at) VALUES ($1, now() + ($2 * interval '1 hour'))`, [hashToken(token), SESSION_HOURS]);

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
  return "ok";
}

// ---------- Session checks ----------

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || token.length > 100) return false;
  const rows = await query(`SELECT 1 FROM sessions WHERE token_hash = $1 AND expires_at > now()`, [hashToken(token)]);
  return rows.length > 0;
}

/** Call at the top of every admin page and every admin action. Sends anyone without a session to the login page. */
export async function requireAdmin(): Promise<void> {
  // Admin pages are always rendered per request, never prerendered or cached.
  await connection();
  if (!(await isAdmin())) redirect("/admin/login");
}

/** Ends the current session, or every session when `everywhere` is true. */
export async function logOut(everywhere = false): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (everywhere) await query(`DELETE FROM sessions`);
  else if (token) await query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
  store.delete(COOKIE);
}
