export default function ChatPage() {
  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Phase 6</p>
          <h1>RO Assistant Chat</h1>
        </div>
        <p>
          Chat จะเป็นชั้นแปลงภาษาธรรมชาติเป็น tool call เท่านั้น
          ตัวเลขทั้งหมดต้องตรงกับ Calculator และ Advisor
        </p>
      </header>
      <section className="panel">
        <p className="eyebrow">Example request</p>
        <h2>“Shadow Cross เล่น Cross Impact งบ 200m ควรเปลี่ยนอะไรก่อน”</h2>
        <p className="hero-copy">
          ระบบจะอ่าน build ปัจจุบัน เรียก budget optimizer และอธิบายผลพร้อมรายการ
          ราคาที่ทราบ ราคาที่เก่า และราคาที่ยังขาด
        </p>
      </section>
    </div>
  );
}
