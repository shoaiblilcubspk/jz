# AGENTS.md — AI Operating Manual

> All rules in `GEMINI.md`. This file = how to work.

## Before Any Task
1. **CRITICAL:** Read `GEMINI.md` fully before anything else (it is the master rulebook).
2. **MANDATORY (Features/Implementation):** Read `docs/IMPACT_360.md` before writing a single line of code.
3. **MANDATORY (UI/Frontend):** Read `docs/UI_RULES.md` and `docs/MODULES.md` before modifying any React components or styles.
4. **MANDATORY (Database/API):** Read `docs/supabase-api-guide.md` before making any Supabase management operations.
5. **MANDATORY (Setup):** Read `docs/setup.md` before setting up any new clone or environment.
3. Create an **Impact Map** for your task to ensure ZERO MISSED ROOTS.
4. Keep your Impact Map updated as you discover new dependencies.
5. Work in a PLANNED manner based on the complete 360-degree impact.
6. Check relevant source files based on your discovery.
7. Implement directly — no back-and-forth, but never skip the discovery phase.
8. **STRICT COMPLIANCE RULE:** Do exactly what the user explicitly instructs. No half-measures. Do not apply your own assumptions to skip or modify explicit instructions. Hamesha poora kaam mandatory hai.
9. **MANDATORY EVIDENCE RULE:** NEVER claim a feature is "100% OK" or "fixed" without providing evidence. You MUST write and run an SQL simulation, or a frontend build check, and show the actual output logs as proof of atomicity/security before confirming. Use negative testing (fail-closed checks) to prove that invalid inputs are correctly blocked.

## Hard Limits
- **File size: 300 lines MAX.** Split if bigger.
- **Stock: NEVER write `products.stock` from frontend.** RPCs only.
- **Database: Supabase Management API only.** No Prisma, no psql.
- **RBAC: NEVER break `docs/RBAC_RULES.md`.** Ye file final permission authority hai (Admin=Control, Manager=Operate, Cashier=Sell). Har role/permission/settings/user-management change se pehle isko check karo — jo iske khilaf ho (UI bypass, hardcoded `isAdmin=true`, fail-open auth, naya permission system) wo KABHI na karo. Permission sirf `src/lib/permissions.ts` matrix + server-side signed guards se.

## Where Things Live
| What | Where |
|------|-------|
| Services | `src/lib/services/` (one file per entity, barrel `index.ts`) |
| State | `src/stores/` (Zustand, one store per domain) |
| Shared UI | `src/shared/ui/` + `src/shared/modules/` |
| Types | `src/types/index.ts` |
| Local DB | `src/lib/localDb.ts` (display-only cache, NOT source of truth) |
| Schema | `supabase/schema/SUPER_MASTER_SCHEMA.sql` |
| UI docs | `docs/UI_RULES.md` + `docs/MODULES.md` |
| Permissions authority | `docs/RBAC_RULES.md` (NEVER break) + matrix `src/lib/permissions.ts` |

## Communication
- Roman Urdu, short, direct action
- One response, complete fix — no back-and-forth
- For large tasks: create `todo.md` to track progress
