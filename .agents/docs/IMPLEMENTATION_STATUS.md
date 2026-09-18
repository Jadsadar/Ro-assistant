# Implementation Status

Updated: 2026-08-20

Ordering and step numbers follow `.agents/docs/FIX_PLAN_TH.txt`.

## Phase 0 — Baseline and Contracts

- [x] Catalog and knowledge shared types
- [x] Knowledge JSON schema version
- [x] Initial golden calculator fixture from Angular legacy
- [x] Deterministic calculator parity harness
- [x] STEP 0.1 Parity fixtures generated from the legacy source (`npm run parity:fixtures`)
- [x] STEP 0.2 Parity tests comparing the new rules against those fixtures

## Phase 1 — Foundation and Catalog

- [x] Next.js static export scaffold
- [x] Routes: overview, calculator, advisor, knowledge, chat, data settings
- [x] Build-time catalog generator
- [x] Content-hashed manifest and data chunks
- [x] Small search asset separated from full item details
- [x] IndexedDB schema version 1
- [x] Price parser and variant fingerprint
- [x] Knowledge Dashboard search/filter
- [x] Save variant, price quote and tags
- [x] JSON export/import with merge and replace
- [x] Production static build

## Phase 1 (plan) — Equipment rules parity

- [x] STEP 1 Weapon capabilities split into `canEquipLeftWeapon` / `allowsShield` / `allowsAmmo` / `twoHanded`
- [x] STEP 2 Shared class compatibility module, applied in Calculator V2 with sanitize-on-class-change
- [x] STEP 3 Weapon/shield/off-hand/ammo state machine, plus the missing Ammo slot
- [x] STEP 4 Legacy refine semantics; grade decoupled from refine
- [x] STEP 5 Validation layer between calculator state and the damage engine

## Phase 2 (plan) — Complete engine input

- [x] STEP 6.1 Active and passive skill levels sent to the engine
- [x] STEP 6.2 Random options selectable in V2 and converted to extra-option scripts
- [x] STEP 6.3 Every enchant group rendered and sent (the 3-group truncation is gone)
- [x] STEP 6.4 Pet and all six costume enchant slots added
- [x] STEP 6.5 Clearing a card empties its own slot instead of shifting the rest
- [ ] Expand golden coverage across classes, damage types and buff combinations
- [ ] Extract the engine into framework-independent pure TypeScript modules

## Phase 3 (plan) — Calculator consolidation

- [ ] STEP 7 Move saved builds, variants, prices and drafts into V2
- [ ] STEP 8 Make V2 the canonical `/calculator` route

## Phase 4 (plan) — Missing legacy surfaces

- [ ] STEP 9 Battle / equipment / penetration / skill-bonus summary panels
- [ ] STEP 10 Item search, elemental table, monster data view, preset table and summary

## Phase 5–8 (plan)

- [ ] STEP 11 Browser/E2E scenarios
- [ ] STEP 12 Knowledge Dashboard completion (item detail lazy load, price history editing,
      owned items, import conflict preview, IndexedDB integration tests)
- [ ] STEP 13 Advisor MVP (candidate index, Web Worker, target/budget modes)
- [ ] STEP 14 Chat runtime (tool contract, dispatcher, guardrails, MCP adapter)

## Verified Evidence (2026-08-20)

- Catalog build: 6,490 items and 328 monsters, source release 3.2.28 (`ff883cc`)
- Parity fixtures: 921 weapons, 150 off-hand weapons, 45 ammo, 26 items with >3 enchant groups
- Unit tests: 53 passing (`npx tsx --test tests/*.test.ts`)
- ESLint: clean across `src`, `scripts` and `tests`
- TypeScript: passing
- Next production build: all 8 routes statically prerendered

### Catalog corrections from this pass

| Metric | Before | After |
| --- | ---: | ---: |
| Off-hand weapon list | 478 | 150 |
| Ammo items reaching the ammo slot | 0 (16 consumables instead) | 45 |
| Refinable accessories | 383 | 3 |
| Gradable items | 691 | 703 |

Ammo was reading `itemTypeId 3`, which is the legacy consumable bucket; ammo is 4.
The gradable count moved because `resolveCanGrade()` no longer consults `isRefinable`,
a coupling the legacy calculator never had. All 639 source-flagged items remain
gradable; the other 64 come from the documented Patent/-LT name heuristic.

## Known gaps

- `/calculator` and `/calculator-v2` still exist side by side; only V2 has the
  corrected equipment rules and the damage engine, and only `/calculator` has
  persistence. STEP 7 closes this.
- No browser/E2E coverage yet, so UI-level regressions are still caught by review
  rather than by tests.
- npm audit advisories from the previous pass have not been re-checked.
