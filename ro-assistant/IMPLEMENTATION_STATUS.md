# Implementation Status

Updated: 2026-06-14

## Phase 0 — Baseline and Contracts

- [x] Catalog and knowledge shared types
- [x] Knowledge JSON schema version
- [ ] Golden calculator fixtures from Angular legacy
- [ ] Calculator parity harness

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

## Phase 2 — Calculator Parity

- [ ] Port pure calculator engine
- [ ] Port job/skill formulas
- [ ] Golden parity tests
- [ ] Calculator UI

## Phase 3 — Knowledge Dashboard Completion

- [x] Core local knowledge workflow
- [ ] Item detail lazy loading
- [ ] Edit/delete price history
- [ ] Owned item management
- [ ] Import preview with conflict report
- [ ] Browser integration tests

## Phase 4–6

- [ ] Advisor Web Worker
- [ ] Target damage recommendation
- [ ] Budget set optimizer
- [ ] Chat tool dispatcher
- [ ] MCP adapter

## Verified Evidence

- Catalog build: 6,490 items and 328 monsters
- Unit tests: price, fingerprint and import/export
- ESLint: passing
- TypeScript: passing
- Next production build: all routes statically prerendered
- npm audit: 0 vulnerabilities
