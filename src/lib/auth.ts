import "server-only";

import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "apa_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_ITERATIONS = 310_000;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 bytes.");
  }
  return secret;
}

export function verifyPasswordAgainstHash(password: string, encoded: string | undefined): boolean {
  if (!encoded || password.length === 0 || password.length > 1024) return false;

  const [algorithm, iterationsText, saltHex, expectedHex, extra] = encoded.split("$");
  const iterations = Number(iterationsText);
  if (
    algorithm !== "pbkdf2" ||
    iterations !== PASSWORD_ITERATIONS ||
    !saltHex || !/^[a-f0-9]{32}$/i.test(saltHex) ||
    !expectedHex || !/^[a-f0-9]{64}$/i.test(expectedHex) ||
    extra !== undefined
  ) return false;

  try {
    const actual = pbkdf2Sync(password, Buffer.from(saltHex, "hex"), iterations, 32, "sha256");
    const expected = Buffer.from(expectedHex, "hex");
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function getCurrentPasswordHash(): Promise<string | undefined> {
  try {
    const { data, error } = await getSupabaseAdmin().from("app_settings").select("value").eq("key", "password_hash").maybeSingle();
    if (error) return undefined;
    if (typeof data?.value === "string") return data.value;
    return process.env.APP_PASSWORD_HASH;
  } catch {
    return undefined;
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  return verifyPasswordAgainstHash(password, await getCurrentPasswordHash());
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const digest = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, "sha256");
  return `pbkdf2${PASSWORD_ITERATIONS}${salt.toString("hex")}${digest.toString("hex")}`;
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function createSessionToken(): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const nonce = randomBytes(16).toString("base64url");
  const payload = `${expiresAt}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidSessionToken(token: string | undefined): boolean {
  if (!token || token.length > 512) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiryText, nonce, signature] = parts;
  const expiry = Number(expiryText);
  if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(Date.now() / 1000) || !nonce || !signature) return false;

  try {
    const expected = Buffer.from(sign(`${expiryText}.${nonce}`));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function isRequestAuthenticated(request: NextRequest): boolean {
  return isValidSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
}

export const sessionCookie = {
  name: SESSION_COOKIE,
  maxAge: SESSION_SECONDS,
};
