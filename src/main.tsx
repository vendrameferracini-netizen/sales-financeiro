import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { FinanceProvider } from "./contexts/FinanceContext";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FinanceProvider>
      <App />
    </FinanceProvider>
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
