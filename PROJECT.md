# Project: Spariom-CRM

## Architecture
- **Framework & Runtime**: Full-stack TanStack Start (`@tanstack/react-start: ^1.167.50`) running on Nitro (`3.0.260603-beta`) and Vite 7 (`^7.3.1`) with React 19 and TypeScript 5.8.
- **Design System**: Sorvo aesthetic with modern CSS variables, OKLCH / hex Golden-Amber Spariom palette (`#d2953c`), frosted glassmorphism (`backdrop-filter: blur(26px) saturate(170%)`), rim lighting borders, and smooth spring animations.
- **Backend & Database**: Supabase PostgreSQL (`tivecvbokrkooaznfjdy`), 18 relational tables, 17 custom ENUMs, Row Level Security (RLS) policies, Security Definer automated business triggers, and private storage buckets (`contract-documents`, `customer_documents`).
- **State & Data Layer**: TanStack Query v5 with server functions, React Context for session management, and URL search parameters for filter state.
- **Testing & Verification**: Vitest unit/integration testing suite for CRM models, duplicate detection, and renewal mechanics, alongside automated type-checking and production build.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Base Repository Setup | Adopt BlitzVox-CRM codebase into Spariom-CRM root, initialize Git, configure package scripts and clean dependencies | M1 | Survey (Explorer 1) |
| 2 | Supabase Database Schema | Deploy 18 tables, 17 enums, RLS policies, RBAC roles, automated triggers, and storage buckets to target Supabase project (`tivecvbokrkooaznfjdy`) | M1 | Survey (Explorer 2) |
| 3 | Supabase Client & Env Config | Replace hardcoded legacy Supabase URL/keys, configure `.env` and `.env.example`, wire client SDK | M1 | Survey (Explorer 1, 2) |
| 4 | Brand Assets & Logo Integration | Integrate Spariom emblem, logo assets, favicon, and brand metadata across app shell | M2 | Survey (Explorer 3) |
| 5 | Sorvo Design Tokens & CSS | Modern CSS variables, Spariom golden-amber palette (`#d2953c`), glassmorphism, rim borders, typography | M2 | Survey (Explorer 3) |
| 6 | Sorvo App Shell & Navigation | Floating sidebar with 256px to 84px rail collapse, sticky header, search, notification bell, theme ripple transition | M2 | Survey (Explorer 3) |
| 7 | Authentication & Login UI | Sorvo-styled branded authentication screen, email allowlist validation, session management | M2 | Survey (Explorer 2, 3) |
| 8 | Dashboard Module | KPI cards, monthly sales target progress, contract distribution charts, pipeline funnel, recent activity | M3 | Survey (Explorer 1, 3) |
| 9 | Leads (Interessenten) Module | Quick-capture modal, 13 lead sources, DISG behavior profiling, search, status pipeline, conversion to Customer | M3 | Survey (Explorer 1, 3) |
| 10 | Contacts (Kunden) 360° Hub | Full customer detail view, 5 tabs (Contracts, Documents, Clarifications, Tasks, Households), timeline notes, CRUD | M3 | Survey (Explorer 1, 3) |
| 11 | Deals (Verträge) Kanban Board | `@dnd-kit` drag-and-drop pipeline (5 stages, 6 contract types), renewal Ampel buckets, intelligent duplicate detector | M3 | Survey (Explorer 1, 3) |
| 12 | Tasks (Aufgaben) Module | Prioritized tasks, due dates, customer linking, error boundary, status toggling | M3 | Survey (Explorer 1, 3) |
| 13 | Clarifications (Klärfälle) Module | 7 clarification categories, urgency scoring (0-4), 15s auto-polling, resolution workflow | M3 | Survey (Explorer 1, 3) |
| 14 | Settings & Team Administration | Email allowlist management, admin user creation/activation/banning, team assignments | M3 | Survey (Explorer 1, 2) |
| 15 | Verification & Build Hardening | Type checking, linting, error boundaries, production asset bundling, and Vitest test suite | M4, M5 | Survey (Explorer 1, 2, 3) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Repository Adoption & Backend Integration | Replicate source repo into Spariom-CRM, execute Supabase schema migrations, configure environment variables, connect client | none | DONE |
| M2 | Sorvo Design System & Brand Foundation | Implement Sorvo CSS tokens, Spariom golden-amber palette, logo assets, app shell (sidebar, header, transitions), auth screen | M1 | DONE |
| M3 | Core CRM Modules & Workflows Alignment | Modernize Dashboard, Leads, Contacts, Deals Kanban, Tasks, Clarifications, and Settings to Sorvo aesthetics while maintaining 100% logic | M2 | DONE |
| M4 | Production Readiness & Build Optimization | Error boundaries, logging, production asset optimization, clean build (`npm run build`), linting (`npm run lint`) | M3 | DONE |
| M5 | Verification & E2E Testing Acceptance | Pass 100% E2E tests (Tiers 1-4) published by E2E Testing Track; execute Phase 2 adversarial coverage hardening (Tier 5) | M4, TEST_READY.md | DONE |

## Interface Contracts
### Frontend ↔ Supabase Client (`src/lib/supabase/client.ts`)
- `createClient()` configured via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Database types generated in `src/integrations/supabase/types.ts`.
- Server functions in `src/lib/*.functions.ts` using `SUPABASE_SERVICE_ROLE_KEY` for administrative operations (user allowlist, team management).

### App Shell ↔ Navigation (`src/routes/_app.tsx`)
- Navigation items: Dashboard (`/dashboard`), Leads (`/interessenten`), Customers (`/kunden`), Deals (`/vertraege`), Renewals (`/vertragsablauf`), Tasks (`/aufgaben`), Clarifications (`/klaerfaelle`), Team (`/team`), Settings (`/profil`, `/benutzer`).
- Rail toggle state synced with local storage and CSS classes (`.side--collapsed`).

## Code Layout
- `src/routes/`: TanStack Router file-based route tree
- `src/components/`: Reusable UI components (shadcn/ui + Sorvo customized components)
- `src/lib/`: Business logic, Supabase client, server functions, type definitions
- `src/styles.css`: Global design tokens, OKLCH palette, glassmorphism utilities
- `supabase/migrations/`: SQL migration files for database schema and policies
- `tests/`: Automated unit and integration test suites
