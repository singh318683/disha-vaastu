import { X } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider.tsx";
import { detectCurrency, formatPrice, PLANS, priceOf, type PayCurrency, type PlanId } from "@/lib/plans.ts";

interface CheckoutResponse {
  ok?: boolean;
  reason?: string;
  keyId?: string;
  orderId?: string;
  subscriptionId?: string;
  currency?: PayCurrency;
}

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature: string;
  razorpay_subscription_id?: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function Paywall({
  paymentsReady,
  onClose,
  onToken,
}: {
  paymentsReady: boolean;
  onClose: () => void;
  onToken: (token: string) => void;
}) {
  const { u } = useI18n();
  const currency = detectCurrency();
  const [plan, setPlan] = useState<PlanId>("yearly");
  const [email, setEmail] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [restore, setRestore] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const names: Record<PlanId, string> = {
    monthly: u("planMonthly"),
    yearly: u("planYearly"),
    lifetime: u("planLifetime"),
    report: u("planReport"),
  };

  async function buy() {
    if (!paymentsReady) return;
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, email, currency }),
      });
      const checkout = (await response.json()) as CheckoutResponse;
      if (!checkout.ok || !checkout.keyId) {
        setNote(u("paymentsSoon"));
        return;
      }
      await loadRazorpay();
      if (!window.Razorpay) {
        setNote(u("paymentsSoon"));
        return;
      }
      const checkoutPlan = plan;
      const checkoutEmail = email;
      const razorpay = new window.Razorpay({
        key: checkout.keyId,
        order_id: checkout.orderId,
        subscription_id: checkout.subscriptionId,
        name: "Disha",
        description: names[checkoutPlan],
        prefill: { email: checkoutEmail },
        theme: { color: "#e4c36a" },
        handler: (result: RazorpaySuccess) => {
          void finish(checkoutPlan, checkoutEmail, result);
        },
      });
      razorpay.open();
    } catch {
      setNote(u("paymentsSoon"));
    } finally {
      setBusy(false);
    }
  }

  async function finish(checkoutPlan: PlanId, checkoutEmail: string, result: RazorpaySuccess) {
    const response = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: checkoutPlan,
        email: checkoutEmail,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_order_id: result.razorpay_order_id,
        razorpay_subscription_id: result.razorpay_subscription_id,
        razorpay_signature: result.razorpay_signature,
      }),
    });
    const body = (await response.json()) as { ok?: boolean; token?: string };
    if (body.ok && body.token) onToken(body.token);
    else setNote(u("paymentsSoon"));
  }

  async function restorePurchase() {
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, paymentId }),
      });
      const body = (await response.json()) as { ok?: boolean; token?: string };
      if (body.ok && body.token) onToken(body.token);
      else setNote(u("paymentsSoon"));
    } catch {
      setNote(u("paymentsSoon"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-screen="paywall" className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[#0b1024] px-4 pt-[max(0.8rem,env(safe-area-inset-top))] pb-[max(0.7rem,env(safe-area-inset-bottom))] text-foreground">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Disha</p>
        <button type="button" onClick={onClose} aria-label={u("close")} className="grid h-10 w-10 place-items-center rounded-full bg-card">
          <X className="h-5 w-5" />
        </button>
      </div>
      <h1 className="mt-2 font-serif text-[clamp(1.7rem,7vw,2.2rem)] leading-none">{u("paywallTitle")}</h1>
      <p className="mt-2 line-clamp-2 text-sm leading-snug text-muted-foreground">{u("paywallLine")}</p>
      <label className="mt-3 block text-xs text-muted-foreground">
        {u("emailLabel")}
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          className="mt-1 h-11 w-full rounded-2xl border border-[#e4c36a]/40 bg-card px-3 text-base text-foreground outline-none"
        />
      </label>
      {restore ? (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">{u("restoreHelp")}</p>
          <input
            value={paymentId}
            onChange={(event) => setPaymentId(event.target.value)}
            placeholder={u("paymentIdLabel")}
            className="mt-2 h-11 w-full rounded-2xl border border-[#e4c36a]/40 bg-card px-3 text-base outline-none"
          />
          <button type="button" disabled={busy || !email.includes("@") || !paymentId} onClick={() => void restorePurchase()} className="mt-3 h-12 w-full rounded-full bg-primary text-base font-medium text-primary-foreground disabled:opacity-50">
            {u("restorePurchase")}
          </button>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {PLANS.map((offer) => {
            const selected = plan === offer.id;
            return (
              <button
                key={offer.id}
                type="button"
                onClick={() => setPlan(offer.id)}
                className={selected ? "rounded-2xl border border-[#e4c36a] bg-[#e4c36a]/15 px-3 py-2 text-left" : "rounded-2xl border border-[#e4c36a]/25 bg-card px-3 py-2 text-left"}
              >
                <span className="block font-serif text-lg leading-none">{names[offer.id]}</span>
                <span className="mt-1 block text-sm text-primary">{formatPrice(priceOf(offer, currency), currency)}</span>
                {offer.trialDays > 0 && <span className="mt-0.5 block text-[0.68rem] text-muted-foreground">{u("trialNote")}</span>}
              </button>
            );
          })}
        </div>
      )}
      {!restore && (
        <button
          type="button"
          disabled={busy || !paymentsReady || !email.includes("@")}
          onClick={() => void buy()}
          className="mt-3 h-12 w-full rounded-full bg-primary text-base font-medium text-primary-foreground disabled:opacity-60"
        >
          {paymentsReady ? names[plan] : u("paymentsSoon")}
        </button>
      )}
      {note && <p className="mt-2 text-center text-xs text-muted-foreground">{note}</p>}
      <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted-foreground">
        <button type="button" className="underline" onClick={() => setRestore((open) => !open)}>
          {u("restorePurchase")}
        </button>
        <span>
          <a className="underline" href="/terms.html">{u("terms")}</a>
          {" · "}
          <a className="underline" href="/privacy.html">{u("privacy")}</a>
        </span>
      </div>
    </section>
  );
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("razorpay"));
    document.head.append(script);
  });
}
