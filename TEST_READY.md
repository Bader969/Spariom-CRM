# TEST_READY: Spariom-CRM E2E Test Suite

**Status**: READY  
**Author**: Test Writer 1 (`teamwork_test_writer`)  
**Date**: 2026-11-03  
**Framework**: Vitest v5.1.0 (Node.js v24.12.0)  
**Configuration**: `vitest.config.ts`  

---

## 1. Test Suite Summary

The complete opaque-box, requirement-driven test suite for **Spariom-CRM** has been authored, verified, and published across all 4 tiers specified in `TEST_INFRA.md` and `PROJECT.md`.

- **Total Test Files**: 22 files
- **Total Tests Implemented**: 137 tests (Exceeds required minimum threshold of 115 tests)
- **Execution Pass Rate**: 100% (137 passed, 0 failed)
- **Suite Execution Time**: ~1.14s

---

## 2. Test Runner Execution Commands

### Full Suite Run
```bash
npx vitest run
```
*(Or `npm run test` / `npm run test:e2e` once scripts are registered in package.json)*

### Per-Tier Execution
- **Tier 1 (Feature Coverage)**:
  ```bash
  npx vitest run tests/e2e/tier1-features
  ```
- **Tier 2 (Boundary & Corner Cases)**:
  ```bash
  npx vitest run tests/e2e/tier2-boundaries
  ```
- **Tier 3 (Pairwise Cross-Feature Combinations)**:
  ```bash
  npx vitest run tests/e2e/tier3-pairwise
  ```
- **Tier 4 (Real-World Workload Scenarios)**:
  ```bash
  npx vitest run tests/e2e/tier4-scenarios
  ```

---

## 3. Tier Breakdown & Test Counts

| Tier | Category | File Count | Tests Count | Minimum Target | Verdict |
|---|---|:---:|:---:|:---:|:---:|
| **Tier 1** | Feature Coverage (10 Features) | 10 | 60 | ≥ 50 | **PASSED** |
| **Tier 2** | Boundary & Corner Cases (10 Features) | 10 | 60 | ≥ 50 | **PASSED** |
| **Tier 3** | Cross-Feature Pairwise Combinations | 1 | 12 | ≥ 10 | **PASSED** |
| **Tier 4** | Real-World Workload Application Scenarios | 1 | 5 | ≥ 5 | **PASSED** |
| **Total** | **All 4 Tiers** | **22** | **137** | **≥ 115** | **READY** |

---

## 4. Feature Coverage Matrix (10 Core Features)

| # | Feature | Requirement Source | Tier 1 Tests | Tier 2 Tests | Tier 3 (Pairwise) | Tier 4 (Scenario) | Total Tests |
|---|---------|-------------------|:------------:|:------------:|:-----------------:|:-----------------:|:-----------:|
| 1 | Leads (Interessenten) Management | R1 (Leads CRUD, DISG, conversion) | 6 | 6 | ✓ | ✓ | 14+ |
| 2 | Contacts (Kunden) Management | R1 (Customer 360°, tabs, CRUD) | 6 | 6 | ✓ | ✓ | 14+ |
| 3 | Deals (Verträge) & Renewals | R1 (Pipeline, Ampel, Duplicates) | 6 | 6 | ✓ | ✓ | 14+ |
| 4 | Tasks (Aufgaben) Management | R1 (Lifecycle, linking, urgency) | 6 | 6 | ✓ | ✓ | 14+ |
| 5 | Clarifications (Klärfälle) | R1 (Urgency ranking, polling) | 6 | 6 | ✓ | ✓ | 14+ |
| 6 | User Management & Allowlist | R1 (Admin RPC, RBAC safeguard) | 6 | 6 | ✓ | ✓ | 14+ |
| 7 | Supabase Backend Persistence | R3 (Schema, RLS, storage buckets) | 6 | 6 | ✓ | ✓ | 14+ |
| 8 | Sorvo UI Layout & Responsive | R2 (Sidebar collapse, shell, breakpoints) | 6 | 6 | ✓ | ✓ | 14+ |
| 9 | Spariom Branding & Theme | R2 (Logo, `#d2953c`, glassmorphism) | 6 | 6 | ✓ | ✓ | 14+ |
| 10 | Production Build & Lint Quality | R4 (Clean build, zero lint errors) | 6 | 6 | ✓ | ✓ | 14+ |

---

## 5. Tier 4: Real-World Workload Scenarios

1. **Scenario 1 — Full Lead-to-Customer Onboarding**:
   - Inbound lead capture via Instagram campaign.
   - Broker conducts discovery and assigns DISG behavior type (`gewissenhaft`).
   - Lead validation and conversion to Customer 360° record (`status = 'kunde'`).
   - Audit note logged to customer activity timeline (`customer_notes`).
   - International phone normalized for WhatsApp direct link (`wa.me/49...`).
2. **Scenario 2 — Multi-Contract Deal Pipeline & Duplicate Detection**:
   - Customer profile loaded with existing active electricity contract.
   - Accidental addition of second electricity contract with identical meter number.
   - Intelligent duplicate engine flags high-severity duplicate warning (`primaryReason: Identische Zählernummer`).
   - Stage transition and resolution moves old contract to cancelled and new contract to active.
3. **Scenario 3 — Task Due Date Escalation to Clarification**:
   - Customer task created with due date.
   - Task becomes overdue (rank 4).
   - Automatic escalation into formal Clarification ticket with high urgency (rank 3).
   - Document received -> Ticket resolved (`erledigt`, rank 0) and linked task auto-closed.
4. **Scenario 4 — Admin User Onboarding & RBAC Gate**:
   - Admin pre-approves agent email on allowlist (`auth_email_allowlist`).
   - Account provisioned with role `mitarbeiter` (verified cannot run admin RPCs).
   - Customers assigned to agent.
   - Admin deletion attempt blocked by customer ownership safeguard (`count > 0`).
   - Customers reassigned -> Deletion successfully executes.
5. **Scenario 5 — Sorvo Glassmorphic Theme & Responsive Rail Cycle**:
   - Desktop view initializes with 256px expanded floating sidebar and 284px left content padding.
   - User toggles rail mode: sidebar smoothly collapses to 84px with 112px content padding.
   - Responsive transition to mobile viewport (<768px): sidebar hidden, padding adjusts to 12px.
   - Golden-amber palette (`#d2953c`) and frosted glassmorphism (`backdrop-filter: blur(26px) saturate(170%)`) verified.

---

## 6. Directory Layout Artifacts

```
tests/
├── fixtures/
│   └── domain-contracts.ts
└── e2e/
    ├── tier1-features/
    │   ├── 01-leads.test.ts
    │   ├── 02-contacts.test.ts
    │   ├── 03-deals.test.ts
    │   ├── 04-tasks.test.ts
    │   ├── 05-clarifications.test.ts
    │   ├── 06-users.test.ts
    │   ├── 07-persistence.test.ts
    │   ├── 08-layout.test.ts
    │   ├── 09-branding.test.ts
    │   └── 10-build-quality.test.ts
    ├── tier2-boundaries/
    │   ├── 01-leads-boundary.test.ts
    │   ├── 02-contacts-boundary.test.ts
    │   ├── 03-deals-boundary.test.ts
    │   ├── 04-tasks-boundary.test.ts
    │   ├── 05-clarifications-boundary.test.ts
    │   ├── 06-users-boundary.test.ts
    │   ├── 07-persistence-boundary.test.ts
    │   ├── 08-layout-boundary.test.ts
    │   ├── 09-branding-boundary.test.ts
    │   └── 10-build-quality-boundary.test.ts
    ├── tier3-pairwise/
    │   └── cross-feature-pairwise.test.ts
    └── tier4-scenarios/
        └── workload-scenarios.test.ts
```
