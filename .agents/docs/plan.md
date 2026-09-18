# Calculator V2 Data Connection Plan

## เป้าหมาย

สร้างหน้า Calculator UI ใหม่จากงานใน `.agents/design/` โดยแยกจากหน้าเดิมก่อน เพื่อให้ redesign ได้เต็มที่โดยไม่กระทบ `/calculator` ปัจจุบัน แล้วค่อยเชื่อมข้อมูลจริงทีละส่วนจนถึงการคำนวณดาเมจ

หน้าใหม่ควรรันและทดสอบผ่าน dev server ที่ port `3001`

```bash
npm run dev -- -p 3001
```

## หลักการทำงาน

- ทำ route ใหม่ เช่น `/calculator-v2` ก่อน ยังไม่แทนที่ `/calculator`
- แปลง HTML prototype เป็น React components ไม่ใช้ raw HTML ถาวร
- แยก UI ออกจาก data/state/calculation ให้ชัด
- ใช้ data source เดิมของโปรเจกต์ ไม่สร้าง backend ใหม่ในช่วงแรก
- ข้อมูลเกมอ่านจาก static catalog ใน `public/data/`
- ข้อมูลผู้ใช้ เช่น saved build, item variant, price อ่าน/เขียนผ่าน IndexedDB database `ro-assistant`
- เชื่อมข้อมูลแบบ incremental: แสดง UI ได้ก่อน แล้วค่อยเพิ่ม behavior ทีละก้อน
- งานที่เป็น UI/visual อย่างเดียวไม่ต้องรัน automated test ให้ผู้ใช้ตรวจผลผ่าน browser เป็นหลัก
- รัน test เฉพาะช่วงที่เกี่ยวกับการ save/load ข้อมูล, calculation, data adapter, schema หรือการเพิ่ม data source ใหม่

## Data Sources ที่ต้องเชื่อม

### Static Catalog

โหลดผ่าน `src/lib/catalog/client.ts`

- `loadCatalogSearch()` สำหรับรายการไอเทม การ์ด และอุปกรณ์
- `loadCatalogItemDetail(item)` สำหรับรายละเอียดไอเทม description/script แบบ lazy load
- `loadCatalogItemOptions()` สำหรับ enchant/random option ของไอเทม
- `loadCatalogMonsters()` สำหรับรายการมอนสเตอร์
- `loadCatalogSkills()` สำหรับอาชีพและสกิล

### Local User Knowledge

โหลด/บันทึกผ่าน `src/lib/knowledge/repository.ts`

- `loadKnowledgeSnapshot()` โหลด saved builds, item variants, price quotes, tags, owned items
- `saveKnowledgeEntry()` บันทึก item variant, ราคา, tags
- `saveBuild()` บันทึก build
- `deleteBuild()` ลบ build

## ช่วงที่ 1: UI ใหม่ + เชื่อมข้อมูลพื้นฐาน

### เป้าหมาย

ทำหน้า Calculator ใหม่ให้ใช้งานเป็น UI จริงก่อน โดยเชื่อมข้อมูลหลักเกี่ยวกับไอเทม สกิล อาชีพ สเตตัส การ์ด ออฟของไอเทม และมอนสเตอร์

### งานหลัก

1. สร้าง route ใหม่
   - `src/app/calculator-v2/page.tsx`
   - ใช้เป็นสนามทดลอง redesign โดยยังไม่กระทบหน้าเดิม

2. แยก component จาก HTML design
   - `CalculatorV2Shell`
   - `CharacterPanel`
   - `StatPanel`
   - `SkillPanel`
   - `EquipmentPanel`
   - `EquipmentSlotControl`
   - `CardSelector`
   - `ItemOptionSelector`
   - `MonsterPanel`
   - `BuffConsumablePanel`
   - `CombatSummaryPanel`
   - `SavedBuildPanel`

3. เชื่อมข้อมูลอาชีพและสกิล
   - ใช้ `loadCatalogSkills()`
   - เลือก class แล้ว filter/แสดง skill ของ class นั้น
   - เก็บค่า `classId`, `className`, `skillId`, `skillLevel`

4. เชื่อมข้อมูลสเตตัส
   - ใช้ stat keys จาก calculator metadata เดิม
   - เก็บ state สำหรับ base stats และ trait stats
   - ยังไม่ต้องคำนวณ damage จริงในช่วงนี้

5. เชื่อมข้อมูลไอเทม
   - ใช้ `loadCatalogSearch()`
   - filter ตาม equipment slot
   - แสดงชื่อ รูป thumbnail ถ้ามี และ metadata สำคัญ เช่น slot, refine, grade
   - เมื่อเลือกไอเทม ค่อยโหลดรายละเอียดด้วย `loadCatalogItemDetail(item)`

6. เชื่อมข้อมูลการ์ด
   - ใช้ catalog search ชุดเดียวกัน
   - filter card ด้วย `compositionPos` และ slot rule
   - weapon รองรับ card หลายช่องตาม schema
   - armor/head/accessory/garment/boot/shield รองรับตาม rule ของ equipment slot

7. เชื่อมข้อมูลออฟ/option ของไอเทม
   - ใช้ `loadCatalogItemOptions()`
   - แสดง enchant/random option ตาม item และ equipment slot
   - เก็บเป็น `ItemOption[]`

8. เชื่อมข้อมูลมอนสเตอร์
   - ใช้ `loadCatalogMonsters()`
   - ทำ search/select target monster
   - เก็บ `monsterId`

### ผลลัพธ์ที่ต้องได้

- เปิด `/calculator-v2` ได้บน port `3001`
- UI ใหม่ render ครบตาม design หลัก
- เลือกอาชีพ สกิล สเตตัส ไอเทม การ์ด ออฟ และมอนสเตอร์ได้
- state รวมของ build พร้อมแปลงเป็น draft ได้
- ยังไม่จำเป็นต้องแสดง damage จริง

### ตรวจสอบ

```bash
npm run dev -- -p 3001
```

ช่วงนี้ให้ผู้ใช้ตรวจผลผ่าน browser เป็นหลัก เพราะเป็นงาน UI/visual และ interaction เบื้องต้น

## ช่วงที่ 2: เชื่อม Saved Build และ Knowledge Workflow

### เป้าหมาย

ทำให้หน้าใหม่บันทึก/โหลด build และ item variant ได้จริง โดยใช้ IndexedDB เดิม

### งานหลัก

1. สร้าง data adapter สำหรับ Calculator V2
   - แปลง UI state เป็น `SavedBuild`
   - แปลง equipment selection เป็น item variant หรือ saved equipment selection
   - คุม mapping ระหว่าง `EquipmentSlot` กับ UI slot

2. บันทึก item variant
   - สร้าง fingerprint จาก refine, grade, cards, enchants, random options
   - ใช้ `saveKnowledgeEntry()`
   - ถ้า variant ซ้ำ ให้ reuse record เดิมตาม fingerprint

3. บันทึก build
   - ใช้ `saveBuild()`
   - equipment ใน build ต้องอ้าง variant หรือ selection ตาม contract ปัจจุบัน
   - เก็บ class, skill, stats, monster, server, consumables, buffs

4. โหลด saved builds
   - ใช้ `loadKnowledgeSnapshot()`
   - แสดงรายการ build ที่เคยบันทึก
   - กด load แล้วเติมค่าเข้า UI state

5. รองรับ import/export เดิม
   - ไม่ต้องสร้างระบบใหม่
   - ให้ข้อมูลที่บันทึกจาก `/calculator-v2` export/import ผ่านหน้า settings เดิมได้

6. UX และ validation
   - แจ้ง error เมื่อ catalog load ไม่สำเร็จ
   - แจ้งสถานะตอน save/load
   - ป้องกันค่า invalid เช่น card เกิน slot, refine เกินช่วง, option ไม่ตรง item

### ผลลัพธ์ที่ต้องได้

- สร้าง build ใหม่แล้ว save ได้
- reload หน้าแล้วยัง load build กลับมาได้
- variant/price/tag workflow ยังเข้ากับ Knowledge Dashboard เดิม
- JSON export/import ใช้กับข้อมูลจากหน้าใหม่ได้

### ตรวจสอบ

```bash
npm test
npm run typecheck
```

รัน test เฉพาะ case ที่เกี่ยวกับ IndexedDB repository, import/export, adapter, fingerprint และการ save/load build

## ช่วงที่ 3: ดึงค่าพลังจากไอเทม/การ์ด/สเตตัสเพื่อคำนวณดาเมจ

### เป้าหมาย

เชื่อม calculator engine เพื่อดึงค่าพลังจากไอเทม การ์ด ออฟ สเตตัส สกิล บัฟ และมอนสเตอร์ มาคำนวณดาเมจแล้วแสดงในหน้าใหม่

### งานหลัก

1. กำหนด calculation input contract
   - รวม class, level, job level
   - stats และ trait stats
   - skill id/level
   - attack property
   - target monster
   - equipment ทุก slot
   - card ids
   - enchant/random options
   - refine/grade
   - buffs/consumables

2. สร้าง adapter จาก Calculator V2 state ไปเป็น calculator engine input
   - ไฟล์ที่ควรแยก เช่น `src/lib/calculator/v2-adapter.ts`
   - หลีกเลี่ยงให้ UI component รู้รายละเอียด engine มากเกินไป

3. ดึงค่าพลังจาก item detail/script
   - ใช้ `loadCatalogItemDetail(item)` สำหรับ script/detail ที่จำเป็น
   - รวม effect จาก base item, cards, enchants, random options
   - ระวัง lazy loading: ต้องโหลด detail เฉพาะ item ที่ถูก equip

4. เชื่อมข้อมูลมอนสเตอร์เข้าการคำนวณ
   - monster element, race, size, defense, mdef, level และค่าที่ engine ต้องใช้
   - target panel ต้องส่ง monster record ไม่ใช่แค่ชื่อ

5. Port หรือเชื่อม calculator engine
   - ใช้ legacy `tong-calc-ro/` เป็น reference
   - damage ต้องมาจาก deterministic engine ไม่ใช่ AI
   - เพิ่ม golden fixtures/parity tests เมื่อเริ่ม port สูตร

6. แสดงผล combat summary
   - damage ต่อ hit
   - hits/second หรือ ASPD ถ้ามี
   - DPS โดยประมาณ
   - hit/crit/flee/def/mdef และค่ารวมสำคัญ
   - แสดง warning ถ้ามีข้อมูลไม่ครบ

7. เตรียม Web Worker สำหรับงานหนัก
   - ถ้าการคำนวณ optimizer หรือหลาย combination หนักขึ้น ให้ย้ายไป worker
   - ช่วงแรก damage calculation เดี่ยวอาจทำใน main thread ได้ก่อน

### ผลลัพธ์ที่ต้องได้

- เลือก build แล้วเห็น damage preview จริง
- เปลี่ยนไอเทม/การ์ด/ออฟ/สเตตัส/สกิล/มอนสเตอร์ แล้วผลลัพธ์เปลี่ยนตาม
- มี test ครอบคลุม adapter และสูตรสำคัญ
- พร้อมใช้เป็นฐานให้ Advisor และ optimizer ต่อ

### ตรวจสอบ

```bash
npm test
npm run typecheck
```

รัน test เฉพาะ calculation adapter, damage formulas, golden fixtures และ data contract ที่เกี่ยวข้องกับ engine

## ลำดับไฟล์ที่คาดว่าจะเพิ่มหรือแก้

### เพิ่มใหม่

- `src/app/calculator-v2/page.tsx`
- `src/components/calculator-v2/calculator-v2-shell.tsx`
- `src/components/calculator-v2/character-panel.tsx`
- `src/components/calculator-v2/stat-panel.tsx`
- `src/components/calculator-v2/skill-panel.tsx`
- `src/components/calculator-v2/equipment-panel.tsx`
- `src/components/calculator-v2/equipment-slot-control.tsx`
- `src/components/calculator-v2/card-selector.tsx`
- `src/components/calculator-v2/item-option-selector.tsx`
- `src/components/calculator-v2/monster-panel.tsx`
- `src/components/calculator-v2/combat-summary-panel.tsx`
- `src/lib/calculator-v2/state.ts`
- `src/lib/calculator-v2/data.ts`
- `src/lib/calculator-v2/adapters.ts`

### แก้ไข

- `src/app/globals.css`
- `src/components/app-shell.tsx`
- `src/lib/catalog/client.ts` เฉพาะกรณีต้องเพิ่ม helper สำหรับ query/filter
- `src/lib/knowledge/repository.ts` เฉพาะกรณี schema เดิมไม่พอ
- `src/lib/calculator/*` ในช่วงที่ 3 เมื่อเริ่มต่อ engine

## ความเสี่ยงที่ต้องระวัง

- HTML prototype อาจมี class/style ที่ไม่เหมาะกับ React state ต้องแปลงเป็น component จริง
- `equipment-build-panel.tsx` เดิมมี logic เยอะ ไม่ควรย้ายทีเดียวทั้งหมด
- ข้อมูล item detail เป็น lazy chunk ต้องออกแบบ loading state ให้ดี
- card/enchant/random option ต้องอิง equipment rules ไม่ให้เลือกผิด slot
- damage calculation ต้องมี parity test กับ legacy calculator ก่อนเชื่อว่าถูก
- IndexedDB เป็น local ต่อ browser/device ต้องมี export/import เป็นทางย้ายข้อมูลต่อไป

## Definition of Done รวม

- `/calculator-v2` ใช้งานได้บน port `3001`
- UI ใหม่แยก component ชัดเจน
- เชื่อม catalog และ IndexedDB โดยใช้ data layer เดิม
- บันทึกและโหลด build ได้
- คำนวณ damage ได้จากข้อมูลจริง
- ผู้ใช้ตรวจ UI ผ่าน browser แล้ว
- test ผ่านเฉพาะส่วนที่เกี่ยวกับ persistence, data/schema และ damage calculation
