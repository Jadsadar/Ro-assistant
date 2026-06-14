import Link from "next/link";

const features = [
  {
    href: "/calculator",
    eyebrow: "Build",
    title: "Damage Calculator",
    description: "ประกอบ build เลือกสกิลและมอนสเตอร์ แล้วคำนวณผลแบบ deterministic",
  },
  {
    href: "/advisor",
    eyebrow: "Optimize",
    title: "Item Advisor",
    description: "ค้นหาไอเทมที่เพิ่มดาเมจตาม slot เป้าหมาย และงบประมาณ",
  },
  {
    href: "/knowledge",
    eyebrow: "Local data",
    title: "Knowledge Base",
    description: "ค้นหาไอเทม เพิ่ม variant ราคา ออปชัน และแท็กของคุณ",
  },
  {
    href: "/chat",
    eyebrow: "Explain",
    title: "RO Assistant Chat",
    description: "ถามด้วยภาษาธรรมชาติ โดยตัวเลขอ้างอิงจาก calculation tools",
  },
];

export default function Home() {
  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Local-first RO toolkit</p>
          <h1>วาง build ให้ถึงเป้า โดยรู้ด้วยว่าต้องใช้งบเท่าไร</h1>
          <p className="hero-copy">
            Catalog อยู่ฝั่งหน้าเว็บ ข้อมูลราคาและแท็กเก็บในเครื่องของผู้ใช้
            งานค้นหาหนักจะย้ายไป Web Worker เพื่อให้หน้าจอยังตอบสนองได้ดี
          </p>
        </div>
        <div className="hero-status">
          <span className="status-dot" />
          Foundation phase
          <strong>Catalog + Knowledge Base</strong>
        </div>
      </section>

      <section className="feature-grid" aria-label="ฟีเจอร์หลัก">
        {features.map((feature) => (
          <Link className="feature-card" href={feature.href} key={feature.href}>
            <span className="eyebrow">{feature.eyebrow}</span>
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
            <span className="card-link">เปิดเครื่องมือ →</span>
          </Link>
        ))}
      </section>

      <section className="info-panel">
        <div>
          <p className="eyebrow">Architecture</p>
          <h2>คำนวณจริงก่อน ให้ AI อธิบายทีหลัง</h2>
        </div>
        <p>
          Damage, ราคา และเงื่อนไขไอเทมจะมาจาก structured tools เท่านั้น
          Chat ไม่มีสิทธิ์สร้างตัวเลขขึ้นเอง ทำให้ตรวจสอบคำแนะนำย้อนหลังได้
        </p>
      </section>
    </div>
  );
}
