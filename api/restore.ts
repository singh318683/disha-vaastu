import { grantFromStoredPayment, jsonBody, send, type ApiRequest, type ApiResponse } from "./razorpay.ts";

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== "POST") {
    send(response, 405, { ok: false, reason: "method" });
    return;
  }
  const body = jsonBody(request);
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
  if (!email.includes("@") || !paymentId) {
    send(response, 400, { ok: false, reason: "input" });
    return;
  }
  try {
    send(response, 200, await grantFromStoredPayment(email, paymentId));
  } catch {
    send(response, 200, { ok: false, reason: "not_found" });
  }
}
