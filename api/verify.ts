import { grantFromPayment, jsonBody, send, verifyStoredToken, type ApiRequest, type ApiResponse } from "./razorpay.ts";
import type { PlanId } from "../src/lib/plans.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    send(response, 405, { ok: false, reason: "method" });
    return;
  }
  const body = jsonBody(request);
  if (typeof body.token === "string") {
    send(response, 200, await verifyStoredToken(body.token));
    return;
  }
  const plan = body.plan;
  const email = typeof body.email === "string" ? body.email : "";
  const paymentId = stringField(body, "razorpay_payment_id");
  const signature = stringField(body, "razorpay_signature");
  const orderId = stringField(body, "razorpay_order_id");
  const subscriptionId = stringField(body, "razorpay_subscription_id");
  if ((plan !== "monthly" && plan !== "yearly" && plan !== "lifetime" && plan !== "report") || !email || !paymentId || !signature) {
    send(response, 400, { ok: false, reason: "input" });
    return;
  }
  try {
    const granted = await grantFromPayment({
      email,
      plan: plan as PlanId,
      paymentId,
      orderId,
      subscriptionId,
      signature,
    });
    send(response, 200, granted);
  } catch {
    send(response, 200, { ok: false, reason: "unconfigured" });
  }
}

function stringField(body: Record<string, unknown>, key: string): string | undefined {
  return typeof body[key] === "string" ? body[key] : undefined;
}
