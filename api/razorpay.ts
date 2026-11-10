import { issueToken, readToken, type EntitlementClaims } from "../src/lib/entitlementToken.ts";
import { expiryFor, planById, priceOf, type PayCurrency, type PlanId } from "../src/lib/plans.ts";

interface ApiRequest {
  method?: string;
  body?: unknown;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
}

type Handler = (request: ApiRequest, response: ApiResponse) => Promise<void>;

export function jsonBody(request: ApiRequest): Record<string, unknown> {
  const body = request.body;
  if (typeof body === "string") {
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (body && typeof body === "object") return body as Record<string, unknown>;
  return {};
}

export function paymentsConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.ENTITLEMENT_SECRET);
}

export function planEnv(plan: PlanId, currency: PayCurrency): string | undefined {
  const key = `RAZORPAY_PLAN_${plan.toUpperCase()}_${currency}`;
  return process.env[key];
}

function authHeader(): string {
  const token = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

export async function razorpay(path: string, init?: { method?: string; body?: unknown }): Promise<unknown> {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: init?.body == null ? undefined : JSON.stringify(init.body),
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload ? "razorpay" : "razorpay";
    throw new Error(message);
  }
  return payload;
}

export async function createCheckout(planId: PlanId, currency: PayCurrency, email: string): Promise<Record<string, unknown>> {
  const plan = planById(planId);
  if (!plan || !paymentsConfigured()) return { ok: false, reason: "unconfigured" };
  const amount = priceOf(plan, currency);
  const notes = { email, plan: planId };
  if (plan.recurring) {
    const razorpayPlan = planEnv(planId, currency);
    if (!razorpayPlan) return { ok: false, reason: "unconfigured" };
    const subscription = (await razorpay("/subscriptions", {
      method: "POST",
      body: {
        plan_id: razorpayPlan,
        total_count: planId === "yearly" ? 10 : 36,
        customer_notify: 1,
        notes,
      },
    })) as { id?: string };
    if (!subscription.id) return { ok: false, reason: "unconfigured" };
    return {
      ok: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      subscriptionId: subscription.id,
      currency,
      plan: planId,
    };
  }
  const order = (await razorpay("/orders", {
    method: "POST",
    body: { amount, currency, receipt: `disha_${Date.now()}`, notes },
  })) as { id?: string };
  if (!order.id) return { ok: false, reason: "unconfigured" };
  return { ok: true, keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, currency, amount, plan: planId };
}

export async function grantFromPayment(input: {
  email: string;
  plan: PlanId;
  paymentId: string;
  orderId?: string;
  subscriptionId?: string;
  signature: string;
}): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const entitlement = process.env.ENTITLEMENT_SECRET;
  if (!secret || !entitlement) return { ok: false, reason: "unconfigured" };
  const message = input.subscriptionId ? `${input.paymentId}|${input.subscriptionId}` : `${input.orderId}|${input.paymentId}`;
  const expected = await hmacHex(secret, message);
  if (!safeEqual(expected, input.signature)) return { ok: false, reason: "signature" };
  const now = Date.now();
  const claims: EntitlementClaims = {
    v: 1,
    email: input.email.trim().toLowerCase(),
    plan: input.plan,
    paymentId: input.paymentId,
    iat: now,
    exp: expiryFor(input.plan, now),
  };
  return { ok: true, token: await issueToken(claims, entitlement) };
}

export async function grantFromStoredPayment(email: string, paymentId: string): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  const entitlement = process.env.ENTITLEMENT_SECRET;
  if (!paymentsConfigured() || !entitlement) return { ok: false, reason: "unconfigured" };
  const payment = (await razorpay(`/payments/${encodeURIComponent(paymentId)}`)) as {
    status?: string;
    email?: string;
    notes?: { email?: string; plan?: string };
  };
  const paid = payment.status === "captured" || payment.status === "authorized";
  const owner = (payment.email || payment.notes?.email || "").trim().toLowerCase();
  if (!paid || owner !== email.trim().toLowerCase()) return { ok: false, reason: "not_found" };
  const plan = planById(payment.notes?.plan ?? "")?.id ?? "lifetime";
  const now = Date.now();
  const claims: EntitlementClaims = {
    v: 1,
    email: owner,
    plan,
    paymentId,
    iat: now,
    exp: expiryFor(plan, now),
  };
  return { ok: true, token: await issueToken(claims, entitlement) };
}

export async function verifyStoredToken(token: string): Promise<{ ok: true; plan: PlanId; email: string; exp: number | null } | { ok: false; reason: string }> {
  const secret = process.env.ENTITLEMENT_SECRET;
  if (!secret) return { ok: false, reason: "unconfigured" };
  const claims = await readToken(token, secret, Date.now());
  if (!claims) return { ok: false, reason: "invalid" };
  return { ok: true, plan: claims.plan, email: claims.email, exp: claims.exp };
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

export function send(response: ApiResponse, status: number, body: unknown) {
  response.status(status).json(body);
}

export type { ApiRequest, ApiResponse, Handler };
