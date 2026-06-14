import { KnowledgeDashboard } from "@/components/knowledge/knowledge-dashboard";

export default function KnowledgePage() {
  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Local Knowledge Base</p>
          <h1>Item & Price Dashboard</h1>
        </div>
        <p>
          Catalog เป็นข้อมูล read-only ที่โหลดแบบแยกส่วน ส่วน variant ราคา note
          และ tag จะเก็บใน IndexedDB ของเบราว์เซอร์
        </p>
      </header>
      <KnowledgeDashboard />
    </div>
  );
}
