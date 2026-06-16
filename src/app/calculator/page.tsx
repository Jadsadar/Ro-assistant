import { EquipmentBuildPanel } from "@/components/calculator/equipment-build-panel";

export default function CalculatorPage() {
  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Calculator Foundation</p>
          <h1>Damage Calculator</h1>
        </div>
        <p>
          เลือก Item Variant ตามช่องสวมใส่ก่อนเชื่อม deterministic damage engine
          จากเว็บเก่า
        </p>
      </header>
      <EquipmentBuildPanel />
    </div>
  );
}
