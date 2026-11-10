import type { PlanId } from "./plans.ts";

export interface EntitlementClaims {
  v: 1;
  email: string;
  plan: PlanId;
  paymentId: string;
  iat: number;
  exp: number | null;
}

export async function issueToken(claims: EntitlementClaims, secret: string): Promise<string> {
  const payload = base64UrlEncode(JSON.stringify(claims));
  const signature = await hmacHex(secret, payload);
  return `${payload}.${signature}`;
}

export async function readToken(token: string, secret: string, now: number): Promise<EntitlementClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = await hmacHex(secret, parts[0]);
  if (!safeEqual(expected, parts[1])) return null;
  let claims: EntitlementClaims;
  try {
    claims = JSON.parse(base64UrlDecode(parts[0])) as EntitlementClaims;
  } catch {
    return null;
  }
  if (claims.v !== 1 || typeof claims.email !== "string" || !claims.email) return null;
  if (claims.plan !== "monthly" && claims.plan !== "yearly" && claims.plan !== "lifetime" && claims.plan !== "report") {
    return null;
  }
  if (claims.exp != null && claims.exp <= now) return null;
  return claims;
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
