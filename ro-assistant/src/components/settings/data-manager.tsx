"use client";

import { useEffect, useRef, useState } from "react";
import { loadCatalogManifest } from "@/lib/catalog/client";
import {
  createKnowledgeExport,
  parseKnowledgeExport,
  type KnowledgeBaseExport,
} from "@/lib/knowledge/import-export";
import {
  importKnowledgeSnapshot,
  loadKnowledgeSnapshot,
} from "@/lib/knowledge/repository";
import type { KnowledgeSnapshot } from "@/lib/knowledge/types";

interface StorageInfo {
  usage?: number;
  quota?: number;
  persisted?: boolean;
}

interface CurrentData {
  catalogVersion: string;
  knowledge: KnowledgeSnapshot;
  storage: StorageInfo;
}

function formatBytes(value?: number): string {
  if (value === undefined) return "ไม่ทราบ";
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}

function snapshotCount(snapshot: KnowledgeSnapshot): number {
  return (
    snapshot.itemVariants.length +
    snapshot.priceQuotes.length +
    snapshot.tags.length +
    snapshot.variantTags.length +
    snapshot.ownedItems.length +
    snapshot.savedBuilds.length
  );
}

async function readCurrentData(): Promise<CurrentData> {
  const [manifest, knowledge] = await Promise.all([
    loadCatalogManifest(),
    loadKnowledgeSnapshot(),
  ]);
  let storage: StorageInfo = {};

  if ("storage" in navigator) {
    const [estimate, persisted] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted?.() ?? Promise.resolve(false),
    ]);
    storage = {
      usage: estimate.usage,
      quota: estimate.quota,
      persisted,
    };
  }

  return {
    catalogVersion: manifest.catalogVersion,
    knowledge,
    storage,
  };
}

export function DataManager() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [catalogVersion, setCatalogVersion] = useState("—");
  const [knowledge, setKnowledge] = useState<KnowledgeSnapshot | null>(null);
  const [storage, setStorage] = useState<StorageInfo>({});
  const [pendingImport, setPendingImport] =
    useState<KnowledgeBaseExport | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [status, setStatus] = useState("กำลังอ่านข้อมูล...");
  const [error, setError] = useState("");

  function applyCurrentData(current: CurrentData): void {
    setCatalogVersion(current.catalogVersion);
    setKnowledge(current.knowledge);
    setStorage(current.storage);
    setStatus("ข้อมูลพร้อมใช้งาน");
  }

  useEffect(() => {
    let cancelled = false;
    readCurrentData()
      .then((current) => {
        if (!cancelled) applyCurrentData(current);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error ? reason.message : "อ่านข้อมูลไม่สำเร็จ",
        );
        setStatus("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function exportJson(): void {
    if (!knowledge) return;
    const payload = createKnowledgeExport(knowledge, catalogVersion);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ro-assistant-kb-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(`Export ${snapshotCount(knowledge)} records แล้ว`);
  }

  async function chooseImportFile(file?: File): Promise<void> {
    if (!file) return;
    setError("");
    try {
      const parsed = parseKnowledgeExport(await file.text());
      setPendingImport(parsed);
      setStatus(`อ่านไฟล์สำเร็จ ${snapshotCount(parsed.data)} records`);
    } catch (reason: unknown) {
      setPendingImport(null);
      setError(reason instanceof Error ? reason.message : "อ่านไฟล์ไม่สำเร็จ");
    }
  }

  async function runImport(): Promise<void> {
    if (!pendingImport) return;
    if (
      mode === "replace" &&
      !window.confirm("Replace จะลบ Knowledge Base ปัจจุบันทั้งหมด ดำเนินการต่อหรือไม่?")
    ) {
      return;
    }

    setError("");
    setStatus("กำลัง import...");
    try {
      await importKnowledgeSnapshot(pendingImport.data, mode);
      setPendingImport(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      applyCurrentData(await readCurrentData());
      setStatus(`Import แบบ ${mode} สำเร็จ`);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Import ไม่สำเร็จ");
    }
  }

  async function requestPersistence(): Promise<void> {
    if (!navigator.storage?.persist) return;
    const persisted = await navigator.storage.persist();
    setStorage((current) => ({ ...current, persisted }));
    setStatus(
      persisted
        ? "เบราว์เซอร์อนุญาต persistent storage แล้ว"
        : "เบราว์เซอร์ยังไม่อนุญาต persistent storage",
    );
  }

  return (
    <div className="data-grid">
      <section className="panel data-summary">
        <p className="eyebrow">Current state</p>
        <h2>{status}</h2>
        {error ? <div className="error-banner">{error}</div> : null}
        <dl>
          <div>
            <dt>Catalog version</dt>
            <dd>{catalogVersion}</dd>
          </div>
          <div>
            <dt>Variants</dt>
            <dd>{knowledge?.itemVariants.length ?? "—"}</dd>
          </div>
          <div>
            <dt>Price quotes</dt>
            <dd>{knowledge?.priceQuotes.length ?? "—"}</dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd>{knowledge?.tags.length ?? "—"}</dd>
          </div>
          <div>
            <dt>Storage usage</dt>
            <dd>
              {formatBytes(storage.usage)} / {formatBytes(storage.quota)}
            </dd>
          </div>
          <div>
            <dt>Persistent</dt>
            <dd>{storage.persisted ? "Yes" : "No / Unknown"}</dd>
          </div>
        </dl>
        <div className="form-actions">
          <button
            className="secondary-button"
            onClick={requestPersistence}
            type="button"
          >
            ขอ persistent storage
          </button>
          <button
            className="primary-button"
            disabled={!knowledge}
            onClick={exportJson}
            type="button"
          >
            Export JSON
          </button>
        </div>
      </section>

      <section className="panel import-panel">
        <p className="eyebrow">Restore / Move data</p>
        <h2>Import Knowledge Base</h2>
        <p>
          ระบบตรวจ format และ schema ก่อนเขียน IndexedDB เสมอ
          เลือก merge เพื่อเก็บข้อมูลเดิม หรือ replace เพื่อคืน backup ทั้งชุด
        </p>
        <label>
          <span>ไฟล์ JSON</span>
          <input
            accept="application/json,.json"
            onChange={(event) => chooseImportFile(event.target.files?.[0])}
            ref={fileInputRef}
            type="file"
          />
        </label>
        <label>
          <span>Import mode</span>
          <select
            onChange={(event) =>
              setMode(event.target.value as "merge" | "replace")
            }
            value={mode}
          >
            <option value="merge">Merge กับข้อมูลปัจจุบัน</option>
            <option value="replace">Replace ข้อมูลปัจจุบัน</option>
          </select>
        </label>
        {pendingImport ? (
          <div className="import-preview">
            <strong>ไฟล์พร้อม import</strong>
            <span>Catalog {pendingImport.catalogVersion}</span>
            <span>{pendingImport.data.itemVariants.length} variants</span>
            <span>{pendingImport.data.priceQuotes.length} prices</span>
            <span>{pendingImport.data.tags.length} tags</span>
          </div>
        ) : null}
        <button
          className="primary-button"
          disabled={!pendingImport}
          onClick={runImport}
          type="button"
        >
          Import
        </button>
      </section>
    </div>
  );
}
