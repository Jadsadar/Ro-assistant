import { DataManager } from "@/components/settings/data-manager";

export default function DataSettingsPage() {
  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Local storage</p>
          <h1>Data & Backup</h1>
        </div>
        <p>
          ตรวจ catalog version, พื้นที่ IndexedDB และ import/export Knowledge Base
          แบบ JSON โดยไม่ต้องส่งข้อมูลไป backend
        </p>
      </header>
      <DataManager />
    </div>
  );
}
