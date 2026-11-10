import { paymentsConfigured, send, type ApiRequest, type ApiResponse } from "./razorpay.ts";

export default function handler(_request: ApiRequest, response: ApiResponse) {
  send(response, 200, { ok: true, payments: paymentsConfigured() });
}
