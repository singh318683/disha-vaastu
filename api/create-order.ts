import { createCheckout, jsonBody, paymentsConfigured, send, type ApiRequest, type ApiResponse } from "./razorpay.ts";
import type { PayCurrency, PlanId } from "../src/lib/plans.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    send(response, 405, { ok: false, reason: "method" });
    return;
  }
  if (!paymentsConfigured()) {
    send(response, 200, { ok: false, reason: "unconfigured" });
    return;
  }
  const body = jsonBody(request);
  const plan = body.plan;
  const currency = body.currency === "USD" ? "USD" : body.currency === "INR" ? "INR" : null;
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if ((plan !== "monthly" && plan !== "yearly" && plan !== "lifetime" && plan !== "report") || !currency || !email.includes("@")) {
    send(response, 400, { ok: false, reason: "input" });
    return;
  }
  try {
    const checkout = await createCheckout(plan as PlanId, currency as PayCurrency, email);
    send(response, 200, checkout);
  } catch {
    send(response, 200, { ok: false, reason: "unconfigured" });
  }
}
