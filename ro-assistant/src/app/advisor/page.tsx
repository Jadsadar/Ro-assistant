export default function AdvisorPage() {
  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Phase 4–5</p>
          <h1>Item Advisor</h1>
        </div>
        <p>
          ระบบจัดอันดับไอเทมจะใช้ prebuilt index คัด candidate ก่อนคำนวณจริง
          และย้ายงานหนักไป Web Worker พร้อม progress และ cancellation
        </p>
      </header>
      <section className="coming-grid">
        <article className="coming-card">
          <span>Target</span>
          <h2>Reach damage goal</h2>
          <p>หาราคาต่ำสุดที่ทำดาเมจหรือ DPS ถึงเป้าที่กำหนด</p>
        </article>
        <article className="coming-card">
          <span>Budget</span>
          <h2>Maximize under budget</h2>
          <p>คิดราคาจาก variant ของผู้ใช้และไม่นับ unknown price เป็นศูนย์</p>
        </article>
        <article className="coming-card">
          <span>Evidence</span>
          <h2>Explain every gain</h2>
          <p>แสดง gain, cost, condition, set dependency และวันที่ของราคา</p>
        </article>
      </section>
    </div>
  );
}
