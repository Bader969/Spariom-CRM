# E2E Test Infra: Spariom-CRM

## Test Philosophy
- Opaque-box, requirement-driven derived from `ORIGINAL_REQUEST.md` and user-facing specifications.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Scenarios.
- Progressive testability: verification mechanisms do not depend on features more complex than what is being verified.

## Feature Inventory (Requirements-Driven)
| # | Feature | Source (Requirement) | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Workload) |
|---|---------|---------------------|:----------------:|:-----------------:|:-----------------:|:-----------------:|
| 1 | Leads (Interessenten) Management | R1 (Leads CRUD, DISG, convert) | 5 | 5 | ✓ | ✓ |
| 2 | Contacts (Kunden) Management | R1 (Customer 360°, CRUD) | 5 | 5 | ✓ | ✓ |
| 3 | Deals (Verträge) & Renewals | R1 (Pipeline stages, Ampel, Duplicates) | 5 | 5 | ✓ | ✓ |
| 4 | Tasks (Aufgaben) Management | R1 (Task lifecycle, linking) | 5 | 5 | ✓ | ✓ |
| 5 | Clarifications (Klärfälle) | R1 (Urgency, status, polling) | 5 | 5 | ✓ | ✓ |
| 6 | User Management & Allowlist | R1 (Admin RPC, RBAC) | 5 | 5 | ✓ | ✓ |
| 7 | Supabase Backend Persistence | R3 (CRUD persistence, Auth) | 5 | 5 | ✓ | ✓ |
| 8 | Sorvo UI Layout & Responsive | R2 (Sidebar collapse, shell) | 5 | 5 | ✓ | ✓ |
| 9 | Spariom Branding & Theme | R2 (Logo, golden-amber palette) | 5 | 5 | ✓ | ✓ |
| 10 | Production Build & Lint Quality | R4 (Clean build, zero lint errors) | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Test Runner**: Vitest (`npm run test:e2e` / `npm run test`)
- **Assertion / Framework**: Vitest + @testing-library/react + Playwright/Puppeteer smoke harness
- **Pass/Fail Semantics**: Exit code 0, all assertions pass with 0 failures
- **Directory Layout**:
  - `tests/e2e/tier1-features/`: Unit and component test cases for individual features
  - `tests/e2e/tier2-boundaries/`: Edge cases, invalid inputs, boundary conditions
  - `tests/e2e/tier3-pairwise/`: Cross-feature interactions (e.g. Lead conversion creating Deals + Tasks)
  - `tests/e2e/tier4-scenarios/`: Real-world end-to-end user workflows

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full Lead-to-Customer Onboarding | Lead Capture -> DISG Assessment -> Conversion -> Customer Profile Creation | High |
| 2 | Multi-Contract Deal Pipeline & Duplicate Alert | Customer selection -> 2 contracts added -> Duplicate detection triggered -> Stage transition | High |
| 3 | Task Escalation to Clarification | Customer Task creation -> Overdue status -> Clarification opened with urgency 3 -> Resolution | Medium |
| 4 | Admin User Onboarding & RBAC Gate | Email added to allowlist -> New user registration -> Role assignment -> Protected route check | High |
| 5 | Sorvo Glassmorphic Theme & Responsive Rail Cycle | Desktop load -> Rail collapse toggle -> Theme switch ripple -> Mobile viewport resize | Medium |

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: ≥5 per feature (50 tests minimum across 10 features)
- **Tier 2 (Boundary & Corner Cases)**: ≥5 per feature (50 tests minimum)
- **Tier 3 (Cross-Feature Combinations)**: ≥10 tests covering pairwise feature flows
- **Tier 4 (Real-World Application Scenarios)**: ≥5 comprehensive workload scenarios
- **Total Minimum Test Count**: ≥115 tests
