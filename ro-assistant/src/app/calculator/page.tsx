export default function CalculatorPage() {
  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Phase 2</p>
          <h1>Damage Calculator</h1>
        </div>
        <p>
          พื้นที่สำหรับ port calculation engine จาก Angular โดยรักษา intermediate
          floor และใช้ golden fixtures ตรวจผลลัพธ์ทุก build
        </p>
      </header>
      <section className="coming-grid">
        <article className="coming-card">
          <span>01</span>
          <h2>Character & Skill</h2>
          <p>อาชีพ เลเวล status trait skill และ buff ที่ใช้</p>
        </article>
        <article className="coming-card">
          <span>02</span>
          <h2>Equipment Build</h2>
          <p>เลือก variant จริงจาก Knowledge Base พร้อม refine และ option</p>
        </article>
        <article className="coming-card">
          <span>03</span>
          <h2>Damage Evidence</h2>
          <p>แสดง min, max, DPS และ calculation breakdown ที่ตรวจสอบได้</p>
        </article>
      </section>
    </div>
  );
}
