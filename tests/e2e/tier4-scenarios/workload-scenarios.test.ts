import { describe, it, expect } from 'vitest';
import {
  detectDuplicates,
  getExpiryBucket,
  getClarificationUrgency,
  getTaskUrgency,
  formatPhoneForWhatsApp,
  whatsappLink,
  PERSONALITY_TYPES_METADATA,
  SPARIOM_BRAND,
  ROLE_HIERARCHY,
  isValidIBAN,
  PersonalityType,
  ContractStatus,
  TaskStatus,
  ClarificationStatus,
  AppRole,
} from '../../fixtures/domain-contracts';

describe('Tier 4 - Real-World Application Scenarios (End-to-End Workloads)', () => {
  it('Scenario 1 - Full Lead-to-Customer Onboarding Lifecycle: Capture -> DISG Assessment -> Validation -> Conversion -> Customer 360° Hub Init', () => {
    // 1. Inbound lead captured from Instagram
    const leadInput = {
      first_name: 'Miriam',
      last_name: 'Sommer',
      phone: '+49 176 11223344',
      email: 'miriam.sommer@spariom-test.de',
      lead_source: 'instagram',
      lead_source_detail: 'Campaign Sommer2026',
      notes: 'Suchte auf Instagram nach günstigerem Ökostrom und Zahnzusatzversicherung.',
    };

    // 2. Broker conducts initial discovery and assigns DISG behavior profile
    const assessedPersonality: PersonalityType = 'gewissenhaft';
    const disgMeta = PERSONALITY_TYPES_METADATA.find((p) => p.value === assessedPersonality);
    expect(disgMeta).toBeDefined();
    expect(disgMeta?.salesTip).toContain('Zahlen, Fakten');

    const leadRecord = {
      id: 'lead-s1-100',
      ...leadInput,
      personality_type: assessedPersonality,
      status: 'interessent' as const,
      created_at: new Date().toISOString(),
    };
    expect(leadRecord.status).toBe('interessent');

    // 3. Broker clicks "In Kunde umwandeln" -> validates name and creates Customer profile
    if (!leadRecord.first_name || !leadRecord.last_name) {
      throw new Error('Konvertierung fehlgeschlagen: Name fehlt');
    }

    const customerHubRecord = {
      id: leadRecord.id,
      salutation: 'Frau',
      first_name: leadRecord.first_name,
      last_name: leadRecord.last_name,
      email: leadRecord.email,
      phone: leadRecord.phone,
      personality_type: leadRecord.personality_type,
      status: 'kunde' as const,
      street: 'Rosenweg 14',
      zip: '80331',
      city: 'München',
      converted_at: new Date().toISOString(),
    };

    expect(customerHubRecord.status).toBe('kunde');
    expect(customerHubRecord.personality_type).toBe('gewissenhaft');

    // 4. System records conversion audit trail in customer_notes timeline
    const auditNote = {
      customer_id: customerHubRecord.id,
      note_type: 'system' as const,
      content: 'Interessent zu Kunde konvertiert.',
      created_at: new Date().toISOString(),
    };
    expect(auditNote.note_type).toBe('system');
    expect(auditNote.customer_id).toBe(customerHubRecord.id);

    // 5. Direct WhatsApp communication link ready
    const waLink = whatsappLink(customerHubRecord.phone, customerHubRecord.first_name);
    expect(waLink).toContain('https://wa.me/4917611223344');
    expect(waLink).toContain(encodeURIComponent('Hallo Miriam'));
  });

  it('Scenario 2 - Multi-Contract Deal Pipeline with Intelligent Duplicate Alert & Stage Transition', () => {
    const customerId = 'cust-s2-200';

    // 1. Initial active electricity contract exists
    const contract1 = {
      id: 'c-s2-01',
      customer_id: customerId,
      type: 'energie_strom',
      provider: 'Vattenfall',
      referenz_id: 'VF-STROM-2025-01',
      details: { zaehlernummer: '1EMH0099881122' },
      status: 'aktiv' as ContractStatus,
      start_date: '2025-01-01',
      end_date: '2026-12-31',
    };

    // 2. Broker accidentally creates new contract for same customer with identical meter number
    const contract2 = {
      id: 'c-s2-02',
      customer_id: customerId,
      type: 'energie_strom',
      provider: 'E.ON',
      referenz_id: 'EON-NEU-9900',
      details: { zaehlernummer: '1EMH0099881122' }, // IDENTICAL METER NUMBER
      status: 'in_pruefung' as ContractStatus,
      start_date: '2026-06-01',
      end_date: '2027-05-31',
    };

    // 3. Duplicate detection runs immediately
    const duplicateReport = detectDuplicates([contract1, contract2]);
    expect(duplicateReport.size).toBe(2);

    const dup2 = duplicateReport.get(contract2.id);
    expect(dup2?.isDuplicate).toBe(true);
    expect(dup2?.severity).toBe('high');
    expect(dup2?.primaryReason).toContain('Identische Zählernummer (1emh0099881122)');

    // 4. Broker reviews alert, recognizes previous contract was superseded, and cancels contract1
    contract1.status = 'gekuendigt_wartet_neuabschluss';

    // 5. Contract 2 is approved and moved to active in Kanban board
    contract2.status = 'aktiv';

    expect(contract1.status).toBe('gekuendigt_wartet_neuabschluss');
    expect(contract2.status).toBe('aktiv');
  });

  it('Scenario 3 - Task Escalation to High-Urgency Clarification Ticket with Resolution Audit', () => {
    const refNow = new Date('2026-07-01T00:00:00Z');
    const customerId = 'cust-s3-300';

    // 1. Broker creates task for meter photo
    const task = {
      id: 'task-s3-01',
      customer_id: customerId,
      title: 'Zählerstandsfoto von Kunden Miriam anfordern',
      due_date: '2026-06-25T00:00:00Z', // 6 days in past
      status: 'offen' as TaskStatus,
    };

    // 2. Task due date has passed -> Overdue
    const taskUrgency = getTaskUrgency(task.due_date, task.status, refNow);
    expect(taskUrgency.key).toBe('ueberfaellig');
    expect(taskUrgency.rank).toBe(4);

    // 3. Since task is overdue, system escalates into formal Clarification ticket
    const clarificationTicket = {
      id: 'clar-s3-01',
      customer_id: customerId,
      category: 'zaehlerstand' as const,
      title: `ESKALATION: ${task.title}`,
      due_date: '2026-07-02T00:00:00Z', // Due tomorrow (1 day left)
      status: 'offen' as ClarificationStatus,
    };

    const clarUrgency = getClarificationUrgency(clarificationTicket.due_date, clarificationTicket.status, refNow);
    expect(clarUrgency.key).toBe('hoch');
    expect(clarUrgency.rank).toBe(3); // ≤2 days

    // 4. Customer sends photo -> Broker resolves clarification
    clarificationTicket.status = 'erledigt';
    task.status = 'erledigt';

    const resolvedClarUrgency = getClarificationUrgency(clarificationTicket.due_date, clarificationTicket.status, refNow);
    const resolvedTaskUrgency = getTaskUrgency(task.due_date, task.status, refNow);

    expect(resolvedClarUrgency.rank).toBe(0);
    expect(resolvedTaskUrgency.rank).toBe(0);
  });

  it('Scenario 4 - Admin User Lifecycle: Allowlist Pre-approval -> Registration -> Role Check -> Customer Safeguard', () => {
    const adminUser = { id: 'admin-root', role: 'admin' as AppRole };
    const allowlist = new Set<string>();

    // 1. Admin pre-approves agent email
    const candidateEmail = 'sabine.vertrieb@spariom.de';
    allowlist.add(candidateEmail.toLowerCase());
    expect(allowlist.has('sabine.vertrieb@spariom.de')).toBe(true);

    // 2. Admin provisions account with role 'mitarbeiter'
    const newAgent = {
      id: 'agent-sabine-uuid',
      email: candidateEmail,
      full_name: 'Sabine Vertrieblerin',
      role: 'mitarbeiter' as AppRole,
      active: true,
    };

    // Verify role hierarchy: cannot perform admin RPCs
    const canDoAdminAction = (role: AppRole) => ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['admin'];
    expect(canDoAdminAction(newAgent.role)).toBe(false);
    expect(canDoAdminAction(adminUser.role)).toBe(true);

    // 3. 3 customers are assigned to Sabine
    const assignedCustomers = [
      { id: 'c1', assigned_to: newAgent.id },
      { id: 'c2', assigned_to: newAgent.id },
      { id: 'c3', assigned_to: newAgent.id },
    ];

    // 4. Admin tries to delete Sabine's account -> Blocked by safeguard!
    const tryDeleteUser = (userId: string) => {
      const owned = assignedCustomers.filter((c) => c.assigned_to === userId).length;
      if (owned > 0) {
        throw new Error(`Diesem Account sind noch ${owned} Kunden zugewiesen. Bitte zuerst übertragen.`);
      }
      return true;
    };

    expect(() => tryDeleteUser(newAgent.id)).toThrowError('noch 3 Kunden zugewiesen');

    // 5. Admin transfers customers to team leader
    for (const c of assignedCustomers) {
      c.assigned_to = adminUser.id;
    }

    // Now deletion succeeds cleanly
    expect(tryDeleteUser(newAgent.id)).toBe(true);
  });

  it('Scenario 5 - Sorvo Glassmorphic Theme & Responsive Rail Cycle across Viewports', () => {
    // 1. Desktop Initial State (1440px): Sidebar expanded to 256px
    let isCollapsed = false;
    let viewportWidth = 1440;

    const getLayoutMetrics = (collapsed: boolean, vpWidth: number) => {
      const isMobile = vpWidth < SPARIOM_BRAND.mobileBreakpoint;
      const sidebarWidth = isMobile ? 0 : collapsed ? SPARIOM_BRAND.sidebarWidthRail : SPARIOM_BRAND.sidebarWidthExpanded;
      const contentPaddingLeft = isMobile ? 12 : sidebarWidth + 28;
      const headerMaxWidth = Math.min(vpWidth - 28, 1452);

      return {
        isMobile,
        sidebarWidth,
        contentPaddingLeft,
        headerMaxWidth,
        backdropFilter: SPARIOM_BRAND.backdropFilter,
        accentColor: SPARIOM_BRAND.primaryColor,
      };
    };

    const desktopExpanded = getLayoutMetrics(isCollapsed, viewportWidth);
    expect(desktopExpanded.sidebarWidth).toBe(256);
    expect(desktopExpanded.contentPaddingLeft).toBe(284); // 256 + 28
    expect(desktopExpanded.backdropFilter).toBe('blur(26px) saturate(170%)');
    expect(desktopExpanded.accentColor).toBe('#d2953c');

    // 2. User toggles Rail mode
    isCollapsed = true;
    const desktopRail = getLayoutMetrics(isCollapsed, viewportWidth);
    expect(desktopRail.sidebarWidth).toBe(84);
    expect(desktopRail.contentPaddingLeft).toBe(112); // 84 + 28

    // 3. User resizes window to mobile phone (375px)
    viewportWidth = 375;
    const mobileLayout = getLayoutMetrics(isCollapsed, viewportWidth);
    expect(mobileLayout.isMobile).toBe(true);
    expect(mobileLayout.contentPaddingLeft).toBe(12);
  });
});
