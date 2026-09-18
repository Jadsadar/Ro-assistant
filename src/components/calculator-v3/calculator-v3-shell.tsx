"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./calculator-v3.module.css";

const LEGACY_URL = "/legacy-calculator/index.html#/";

/**
 * Hosts the legacy calculator itself rather than a reimplementation of it.
 *
 * `scripts/build-legacy-page.cjs` builds `tong-calc-ro` into
 * `public/legacy-calculator/`, so what renders here is the upstream application:
 * the same templates, PrimeNG components, stylesheet and fixed 1500px grid, with
 * nothing repositioned. The build also injects `ro-assistant-chat.js`, which adds
 * the "Chat with AI" accordion tab directly after "Item Descriptions".
 *
 * The frame fills the viewport below the top bar so the legacy layout keeps its
 * own edges instead of inheriting this app's page padding.
 */
export function CalculatorV3Shell() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading",
  );

  useEffect(() => {
    let isMounted = true;

    // A missing build should say so plainly rather than showing a blank frame.
    fetch("/legacy-calculator/index.html", { method: "HEAD" })
      .then((response) => {
        if (!isMounted) return;
        setStatus(response.ok ? "ready" : "missing");
      })
      .catch(() => {
        if (isMounted) setStatus("missing");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === "missing") {
    return (
      <div className={styles.missing}>
        <h1>ยังไม่ได้ build หน้า Calculator ต้นทาง</h1>
        <p>รันคำสั่งนี้เพื่อสร้างหน้าเว็บเดิมลงใน public/legacy-calculator</p>
        <pre>
          cd tong-calc-ro &amp;&amp; npm install --legacy-peer-deps{"\n"}
          cd .. &amp;&amp; npm run legacy:page
        </pre>
      </div>
    );
  }

  return (
    <iframe
      className={styles.legacyFrame}
      ref={frameRef}
      src={LEGACY_URL}
      title="RO Calculator"
    />
  );
}
