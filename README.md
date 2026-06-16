# RO Assistant
# RO Assistant

เว็บผู้ช่วยจัด build และแนะนำไอเทม Ragnarok Online แบบ local-first

## Current Features

- Next.js static export ไม่ต้องมี application server สำหรับฟังก์ชันหลัก
- catalog pipeline สร้าง search index และ item detail chunks จาก Angular legacy data
- Knowledge Dashboard ค้นหา 6,490 ไอเทมโดยไม่โหลด description/script ทั้งก้อน
- บันทึก item variant, refine, option, ราคา และ tag ลง IndexedDB
- รองรับราคา `50m`, `20 เอ็ม`, `1.2b`, `๕๐ ล้าน`
- JSON export/import แบบ merge หรือ replace
- catalog และข้อมูลผู้ใช้แยกกัน เพื่อให้อัปเดตข้อมูลเกมได้โดยไม่ทับราคา

Calculator, Advisor และ Chat routes ถูกวางโครงไว้ และจะต่อกับ deterministic
calculation engine โดยใช้ `tong-calc-ro/` เป็น legacy reference ภายใน workspace

## Commands

```bash
npm run catalog:build
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
```

`npm run dev` และ `npm run build` จะสร้าง catalog ใหม่จาก:

- `tong-calc-ro/item.json`
- `tong-calc-ro/monster.json`
- `tong-calc-ro/src/assets/demo/data/hp_sp_table.json`
- class and offensive-skill metadata from
  `tong-calc-ro/src/app/jobs/_class-list.ts`

`tong-calc-ro/` เป็น local reference และไม่ถูก commit เข้า Git หาก source นี้ไม่มี
ระบบจะใช้ generated assets ที่ commit ไว้ใน `public/data/` แทน สามารถกำหนดตำแหน่ง
source อื่นได้ด้วย `RO_LEGACY_ROOT`

Static output อยู่ใน `out/`

Calculator-facing data contracts are documented in
[`requirements/DATA_SCHEMA.md`](requirements/DATA_SCHEMA.md).

## Architecture

```text
Static legacy data
  -> scripts/build-catalog.ts
  -> public/data/catalog-manifest.json + hashed chunks
  -> browser catalog loader

User input
  -> IndexedDB (variant, price, tag, owned item, saved build)
  -> JSON backup / restore
```

กติกาสำคัญ:

- `src/lib/core` ในอนาคตต้องเป็น pure TypeScript
- ตัวเลข damage ต้องมาจาก calculator engine ไม่ใช่ AI
- งาน optimize ที่หนักต้องทำใน Web Worker
- unknown price ห้ามถูกนับเป็นราคา 0
