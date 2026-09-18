"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Routes that render the legacy calculator layout verbatim. The shared
 * `.page-container` caps width at 1440px and adds padding, which shifts every
 * edge of a layout built for a fixed 1500px grid, so those routes opt out.
 */
const FULL_BLEED_ROUTES = ["/calculator-v3"];

/**
 * Routes rendered inside another document (the legacy calculator embeds the chat
 * panel in an accordion tab). They must not carry this app's own chrome, so
 * they skip the shell's wrapper and footer entirely.
 */
const EMBEDDED_ROUTES = ["/calculator-v3/chat"];

/** `trailingSlash: true` means pathnames arrive as "/route/", so compare without it. */
function normalize(pathname: string): string {
  return pathname !== "/" && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

/**
 * There is no top bar or navigation: every page is reached by its own path
 * (`/calculator`, `/calculator-v2`, `/calculator-v3`, `/advisor`, `/knowledge`,
 * `/chat`, `/settings/data`). This keeps the full viewport for the page itself,
 * which matters most for the legacy calculator's fixed 1500px grid.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (EMBEDDED_ROUTES.includes(normalize(pathname))) return <>{children}</>;

  const isFullBleed = FULL_BLEED_ROUTES.some(
    (route) =>
      normalize(pathname) === route || pathname.startsWith(`${route}/`),
  );

  return (
    <div className="app-shell">
      <main className={isFullBleed ? "page-full-bleed" : "page-container"}>
        {children}
      </main>
      <footer className="footer">
        <span>RO Assistant</span>
        <span>Static catalog · Local knowledge · Deterministic results</span>
      </footer>
    </div>
  );
}
