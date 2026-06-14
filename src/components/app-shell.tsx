import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/calculator", label: "Calculator" },
  { href: "/advisor", label: "Advisor" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/chat", label: "Chat" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">RO</span>
          <span>
            <strong>Assistant</strong>
            <small>Build with evidence</small>
          </span>
        </Link>
        <nav aria-label="เมนูหลัก">
          {navItems.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <Link className="data-link" href="/settings/data">
          Data
        </Link>
      </header>
      <main className="page-container">{children}</main>
      <footer className="footer">
        <span>RO Assistant</span>
        <span>Static catalog · Local knowledge · Deterministic results</span>
      </footer>
    </div>
  );
}
