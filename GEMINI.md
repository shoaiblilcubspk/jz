# Zaynahs POS — Master Rules

> Single source of truth for ALL AI agents. Short, clear, no band-aids.

---

## 🏢 Business Scope
- **Universal POS** — Clothing, Pharmacy, Restaurant, Retail, Electronics, Grocery. No niche-hardcoding.
- **Terminology:** product / item / category / variant / modifier / addon
- **Single-tenant:** 1 Clone = 1 Shop. No workspace_id, no shift_id (permanently removed).
- **Language:** Roman Urdu responses, short, direct action.

---

## 🏗️ Architecture

### Stack
- React + Vite + TypeScript + Tailwind + Supabase (cloud-direct, single source of truth)
- Lightweight local cache (Dexie) allowed sirf UI display ke liye — CACHE ≠ SOURCE OF TRUTH
- State: Zustand stores (`src/stores/`) — one store per domain
- Services: `src/lib/services/` — one file per entity (barrel export via `index.ts`)
- UI: Shared components from `src/shared/ui/` and `src/shared/modules/`

### Stock Architecture (CRITICAL — READ CAREFULLY)
- **Cloud Supabase DB = ONLY authoritative source for `products.stock`**
- Stock changes ONLY via `stock_history` table inserts → DB trigger (`trigger_update_product_stock`) auto-updates `products.stock`
- Frontend may write local Dexie stock optimistically for display, but cloud is truth
- Realtime product updates from cloud ALWAYS overwrite local stock (no guards)

### Atomic RPCs (ALL stock/sale operations use these)
| Operation | RPC | What it does atomically |
|-----------|-----|------------------------|
| New sale | `commit_sale` | Insert sale + insert stock_history rows (triggers deduct stock) |
| Delete sale | `delete_sale_atomic` | Insert return stock_history (triggers restore stock) + delete sale + tombstone |
| Refund | `refund_sale_atomic` | Insert return stock_history + update sale status/refunded_amount |
| Edit bill | `edit_sale_atomic` | Insert new sale + deduct stock + restore old stock + delete old sale — ALL in one tx |
| Stock adjust | `stock_adjustment` | Insert stock_history (trigger updates stock) — for manual adjustments |

> **NEVER write `products.stock` directly from frontend. NEVER.** Only DB triggers write it.

### Cloud-Direct (NO offline system)
- Har transaction seedha cloud RPC/DB transaction se confirm hoti hai (Nextera style direct Supabase)
- Koi background sync queue, pendingOps, reconcile loop, offline-login fallback NAHI
- Idempotent RPCs (`idempotency_key`) duplicate cloud requests rokne ke liye rehti hain
- Local cache sirf display — transaction validation hamesha cloud

---

## 📏 Code Rules

### File Size & Code Limits (Strict Alignment)
- **MAX 300 lines per file.** If bigger → split into sub-components/modules immediately. No excuses.
- Services: one file per entity in `src/lib/services/`
- Components: split into sub-components in sub-folders. Ensure logic is isolated.
- **Reference**: Always follow the architectural blueprint laid out in `OVERHAUL_PLAN.md`.

### Dexie Local Database (CRITICAL)
- Whenever you add a new table (e.g. `paymentModes`, `salesmen`), you **MUST** bump the `Dexie.version(X)` in `src/lib/PosDB.ts` (e.g., `this.version(24).stores(SCHEMA_CURRENT)`).
- Never just add to `SCHEMA_CURRENT` without adding a new version bump, otherwise the local database will crash on load with `NotFoundError` object store missing.

### State Management
- Zustand stores in `src/stores/` — one store per domain
- NO `useReducer` for app state
- Components subscribe ONLY to the state they need: `useProductsStore(s => s.products)`

### Reports
- Reports ALWAYS query Supabase directly with date filters
- NEVER calculate totals from in-memory `state.sales` array
- Use `fetchAllPages()` — never `.limit()` on financial queries

### Drafts
- Status `pending` / notes contain `DRAFT_SALE` = saved cart
- NEVER touch stock, customer stats, or revenue for drafts

---

## 🎨 UI Rules
- ALL UI from `src/shared/ui/` (Button, Card, Modal, Badge, Select, etc.)
- `src/components/pos/` is the ONLY exemption (dense fast UI)
- Icons: Lucide only. No emoji icons, no mixed icon packs.
- Loaders: `<SkeletonLoader />` only. No generic spinners.
- Modals: center on mobile (`items-center justify-center`). Form modals `maxWidth="lg"|"xl"` + `md:grid-cols-2`.
- Media: ALL image uploads via `MediaLibrary` component. Direct file-pickers banned.
- **MANDATORY**: Before ANY UI or frontend work, read `docs/UI_RULES.md` + `docs/MODULES.md`.

---

## 🗄️ Database Rules
- **Supabase Management API ONLY** (`sbp_` token + curl). No Prisma, no psql, no Dashboard.
- Each schema change = migration file (`supabase/migrations/YYYYMMDDHHMMSS_*.sql`) + update `SUPER_MASTER_SCHEMA.sql`
- **MANDATORY**: For ANY API or database operations, read `docs/supabase-api-guide.md`
- **MANDATORY**: For ANY clone/deployment setup, read `docs/setup.md`

---

## 🔐 Auth & Security
- **Direct cloud login:** Supabase Auth (`signInWithPassword`) — email/password, session persist
- Anon key used (single-tenant) sirf public reads ke liye; auth required actions ke liye logged-in user
- RLS: anon-compatible permissive policies (`USING (true) WITH CHECK (true)`)
- Role enforcement: via signed action-token RPCs, NOT `auth.uid()` checks
- 24-hour session expiry. Network errors = DON'T sign out, use cached profile.

---

## ⚡ Key Principles
1. **Data integrity > everything.** Financial data never approximated. If uncertain → throw error.
2. **Single reversal rule.** Stock reversal happens EXACTLY ONCE, inside the owning service/RPC.
3. **Idempotent operations.** Every sale has `idempotency_key`. Retry = no-op, not double-execution.
4. **Delete wins.** A queued delete survives any later update/upsert attempt (F17).
5. **Tombstones.** Deleted financial records get `row_tombstones` entry — can NEVER be resurrected (F21).
6. **No silent drops.** Type/constraint errors mark ops as `error` for review — never hard-delete financial ops. Always extract exact `error.code`, `error.message`, and `error.details` from Supabase rejections and surface them in the UI.
7. **Universal code.** Every fix works across ALL clones. No shop-specific code.
8. **Time formatting.** Always `formatAppTime/Date/DateTime` from `src/lib/dateUtils.ts`. Never raw `toLocaleTimeString()`.
9. **Cloud-Direct Local Caching.** Local IndexedDB must NEVER block object creation (duplicate fallback) if the cloud successfully verified it doesn't exist. Always use `.clear()` before `.bulkPut()` on startup to ensure exact parity with cloud and prevent stale UI ghosts (especially for new clone setups or wiped DBs).
10. **360° UNIVERSAL IMPACT MAPPING — ZERO-MISSED-ROOT PROTOCOL.** Before writing code or adding ANY new feature/implementation, you MUST read **`docs/IMPACT_360.md`**. Always create an Impact Map, find ALL existing relevant places, and keep the map updated. Zero missed roots.
11. **STRICT COMPLIANCE RULE:** Do exactly what the user explicitly instructs. No half-measures. Do not apply your own assumptions to skip or modify explicit instructions. Hamesha poora kaam mandatory hai.
12. **MANDATORY EVIDENCE RULE:** NEVER claim a feature is "100% OK" or "fixed" without providing evidence. You MUST write and run an SQL simulation, or a frontend build check, and show the actual output logs as proof of atomicity/security before confirming. Use negative testing (fail-closed checks) to prove that invalid inputs are correctly blocked.


---

## 📁 Feature Workflow
1. DB Plan → Migration SQL → Management API push
2. LocalDb update (`localDb.ts`)
3. Types (`types/index.ts`)
4. Service file (`src/lib/services/`)
5. Zustand store update if needed
6. UI Component (shared UI, under 300 lines)
7. Docs update (`MODULES.md`, `UI_RULES.md` if applicable)

---

## 🔧 Credentials
| File | Keys |
|------|------|
| `.env.local` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_MGMT_API_KEY` |

After credential update: `npm run build`, clear browser IndexedDB.
