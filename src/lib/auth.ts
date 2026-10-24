import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "apa_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 bytes.");
  }
  return secret;
}

export function verifyPassword(password: string): boolean {
  const encoded = process.env.APP_PASSWORD_HASH;
  if (!encoded || password.length === 0 || password.length > 1024) return false;

  const [salt, expectedHex, extra] = encoded.split(":");
  if (!salt || !expectedHex || extra !== undefined || !/^[a-f0-9]{32,128}$/i.test(salt) || !/^[a-f0-9]{128}$/i.test(expectedHex)) {
    return false;
  }

  try {
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
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
