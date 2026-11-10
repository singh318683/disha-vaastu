import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Paywall } from "@/components/Paywall.tsx";
import { demoPremiumRequested } from "@/lib/accessRules.ts";

const TOKEN_KEY = "disha.entitlement";

interface AccessValue {
  premium: boolean;
  paywallOpen: boolean;
  openPaywall: () => void;
  closePaywall: () => void;
  paymentsReady: boolean;
  saveToken: (token: string) => void;
}

const AccessContext = createContext<AccessValue | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [premium, setPremium] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paymentsReady, setPaymentsReady] = useState(false);

  useEffect(() => {
    const demo = demoPremiumRequested(import.meta.env.DEV, window.location.search);
    if (demo) {
      setPremium(true);
      return;
    }
    if (!token) {
      setPremium(false);
      return;
    }
    let cancelled = false;
    fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((response) => response.json())
      .then((body: { ok?: boolean }) => {
        if (!cancelled) setPremium(Boolean(body.ok));
      })
      .catch(() => {
        if (!cancelled) setPremium(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config")
      .then((response) => response.json())
      .then((body: { payments?: boolean }) => {
        if (!cancelled) setPaymentsReady(Boolean(body.payments));
      })
      .catch(() => {
        if (!cancelled) setPaymentsReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveToken = useCallback((next: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, next);
    } catch {
      /* The token still applies for this visit. */
    }
    setToken(next);
    setPremium(true);
    setPaywallOpen(false);
  }, []);

  const value = useMemo<AccessValue>(
    () => ({
      premium,
      paywallOpen,
      openPaywall: () => setPaywallOpen(true),
      closePaywall: () => setPaywallOpen(false),
      paymentsReady,
      saveToken,
    }),
    [paywallOpen, paymentsReady, premium, saveToken],
  );

  return (
    <AccessContext.Provider value={value}>
      {children}
      {paywallOpen && <Paywall paymentsReady={paymentsReady} onClose={() => setPaywallOpen(false)} onToken={saveToken} />}
    </AccessContext.Provider>
  );
}

export function useAccess(): AccessValue {
  const value = useContext(AccessContext);
  if (!value) throw new Error("useAccess must be used inside AccessProvider");
  return value;
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
