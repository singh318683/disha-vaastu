import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  // Reload only when a new worker replaces one that was already controlling
  // this page. The first install has nothing stale to replace.
  if (navigator.serviceWorker.controller) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  const register = () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const update = () => {
          registration.update().catch(() => {
            /* Keep the page usable if the update check cannot reach the network. */
          });
        };
        update();
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") update();
        });
        window.addEventListener("pageshow", (event) => {
          if (event.persisted) update();
        });
      })
      .catch(() => {
        /* The app still works as a normal page if the worker cannot register. */
      });
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
}
