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
- Calculator V2 คำนวณ damage, DPS, ASPD, accuracy และ HP/SP ด้วยสูตรจริงจาก `tong-calc-ro`
- damage engine โหลดแบบ lazy และรับ class/skill, stat, อุปกรณ์, refine/grade, card, enchant, monster, ธาตุ และ consumable

Advisor และ Chat routes ยังเป็นโครงสำหรับงานระยะถัดไป ส่วน Calculator V2 ต่อกับ deterministic
damage engine แล้ว โดยใช้ `tong-calc-ro/` เป็นแหล่งสูตรอ้างอิงภายใน workspace

## Commands

```bash
npm run legacy:status
npm run legacy:sync
npm run catalog:build
npm run catalog:update
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
```

`npm run dev` และ `npm run build` จะสร้าง catalog ใหม่จาก:

- `tong-calc-ro/src/assets/demo/data/item.json`
- `tong-calc-ro/src/assets/demo/data/monster.json`
- `tong-calc-ro/src/assets/demo/data/hp_sp_table.json`
- class and offensive-skill metadata from
  `tong-calc-ro/src/app/jobs/_class-list.ts`

`tong-calc-ro/` เป็น local reference และไม่ถูก commit เข้า Git หาก source นี้ไม่มี
ระบบจะใช้ generated assets ที่ commit ไว้ใน `public/data/` แทน สามารถกำหนดตำแหน่ง
source อื่นได้ด้วย `RO_LEGACY_ROOT`

## อัปเดตข้อมูลจาก tong-calc-ro

ใช้คำสั่งเดียวสำหรับดึง release ล่าสุดและสร้าง catalog ใหม่:

```bash
npm run catalog:update
```

ขั้นตอนที่คำสั่งนี้ทำ:

1. `legacy:sync` fetch tags จาก `https://github.com/turugrura/tong-calc-ro.git`
2. เลือก stable release tag ล่าสุด เช่น `3.2.28` แทนการยึด `origin/main`
3. ตรวจว่าไฟล์ tracked ใน `tong-calc-ro/` ไม่มีการแก้ค้างอยู่ แล้ว checkout commit ของ
   release แบบ detached โดยไม่ลบ local branch หรือ untracked files
4. `catalog:build` อ่าน item, monster, HP/SP, enchant และ skill metadata จาก checkout นั้น
5. bundle สูตร calculator เป็น `src/generated/legacy-engine.mjs` เพื่อให้หน้าเว็บคำนวณแบบ client-side
6. สร้างไฟล์ content-hashed ชุดใหม่ใน `public/data/` และบันทึก repository, tag และ
   commit ต้นทางลง `catalog-manifest.json`

ตรวจสถานะหรือระบุเวอร์ชันเองได้:

```bash
npm run legacy:status
npm run legacy:sync -- --dry-run
npm run legacy:sync -- --ref 3.2.28
npm run legacy:sync -- --ref main
```

ถ้ายังไม่มีโฟลเดอร์ `tong-calc-ro/` คำสั่ง sync จะ clone ให้เอง หากมี tracked changes
คำสั่งจะหยุดเพื่อป้องกันงาน local ถูกทับ ส่วน `npm run dev` และ `npm run build` จะไม่
เชื่อมต่อ GitHub อัตโนมัติ แต่ใช้ checkout ที่ sync ไว้ล่าสุด จึงยังพัฒนาและ build แบบ
offline ได้

เมื่อ upstream เพิ่มไอเทม มอนสเตอร์ หรือสูตรใหม่ ให้เพิ่มข้อมูลในไฟล์ tracked ของ
`tong-calc-ro`, สร้าง release tag แล้วฝั่ง RO Assistant รัน `npm run catalog:update`
ไฟล์ catalog ใหม่สามารถ commit เข้า repo นี้ได้โดยไม่กระทบราคา, item variant และ saved
build ของผู้ใช้ เพราะข้อมูลเหล่านั้นอยู่ใน IndexedDB แยกต่างหาก

สามารถเปลี่ยน repo, checkout path หรือ ref เริ่มต้นได้ด้วย `RO_LEGACY_REPO`,
`RO_LEGACY_ROOT` และ `RO_LEGACY_REF`

Static output อยู่ใน `out/`

Calculator-facing data contracts are documented in
[`.agents/requirements/DATA_SCHEMA.md`](.agents/requirements/DATA_SCHEMA.md).

## Architecture

```text
Static legacy data
  -> scripts/build-catalog.ts
  -> public/data/catalog-manifest.json + hashed chunks
  -> browser catalog loader

Legacy calculator source
  -> scripts/build-legacy-engine.cjs
  -> lazy-loaded browser damage engine
  -> Calculator V2 combat summary

User input
  -> IndexedDB (variant, price, tag, owned item, saved build)
  -> JSON backup / restore
```

กติกาสำคัญ:

- `src/lib/core` ในอนาคตต้องเป็น pure TypeScript
- ตัวเลข damage ต้องมาจาก calculator engine ไม่ใช่ AI
- งาน optimize ที่หนักต้องทำใน Web Worker
- unknown price ห้ามถูกนับเป็นราคา 0
