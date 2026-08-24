# AGENTS.md — AI Operating Manual

> All rules in `GEMINI.md`. This file = how to work.

## Before Any Task
1. Read `GEMINI.md` (rules — under 200 lines, read it fully)
2. **MANDATORY: Read `docs/IMPACT_360.md` before writing a single line of code.**
3. Create an **Impact Map** for your task to ensure ZERO MISSED ROOTS.
4. Keep your Impact Map updated as you discover new dependencies.
5. Work in a PLANNED manner based on the complete 360-degree impact.
6. Check relevant source files based on your discovery.
7. Implement directly — no back-and-forth, but never skip the discovery phase.

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
