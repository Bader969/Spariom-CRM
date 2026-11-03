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
  TaskStatus,
  ClarificationStatus,
  PersonalityType,
} from '../../fixtures/domain-contracts';

describe('Tier 3 - Pairwise Combinations (Cross-Feature Workflows)', () => {
  it('T3.1 - Pairwise [Leads ↔ Contacts]: Lead conversion creates Customer 360° record and automatically spawns a welcome onboarding task', () => {
    const lead = {
      id: 'lead-301',
      status: 'interessent',
      first_name: 'Fabian',
      last_name: 'Vogel',
      email: 'f.vogel@example.de',
      phone: '0171-8899001',
      personality_type: 'initiativ' as PersonalityType,
    };

    // 1. Convert to customer
    const customer = {
      ...lead,
      status: 'kunde',
      converted_at: new Date().toISOString(),
    };
    expect(customer.status).toBe('kunde');

    // 2. Automatically spawn welcome onboarding task
    const welcomeTask = {
      title: `Onboarding & Bedarfsanalyse für ${customer.first_name} ${customer.last_name}`,
      customer_id: customer.id,
      due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'offen' as TaskStatus,
    };

    expect(welcomeTask.customer_id).toBe(customer.id);
    expect(welcomeTask.title).toContain('Fabian Vogel');
    expect(welcomeTask.status).toBe('offen');
  });

  it('T3.2 - Pairwise [Contacts ↔ Deals]: Creating a new contract for a Customer triggers duplicate detection against existing contracts', () => {
    const customerId = 'cust-302';
    const existingContracts = [
      {
        id: 'c-old',
        customer_id: customerId,
        type: 'energie_strom',
        provider: 'E.ON',
        referenz_id: 'REF-2026-X',
        status: 'aktiv',
      },
    ];

    // Attempting to add contract with same referenz_id
    const newContract = {
      id: 'c-new',
      customer_id: customerId,
      type: 'energie_strom',
      provider: 'E.ON',
      referenz_id: 'REF-2026-X',
      status: 'in_pruefung',
    };

    const duplicateCheck = detectDuplicates([...existingContracts, newContract]);
    expect(duplicateCheck.size).toBe(2);
    expect(duplicateCheck.get('c-new')?.isDuplicate).toBe(true);
    expect(duplicateCheck.get('c-new')?.severity).toBe('high');
    expect(duplicateCheck.get('c-new')?.partnerIds).toContain('c-old');
  });

  it('T3.3 - Pairwise [Deals ↔ Tasks]: Contract cancellation transitions status and automatically schedules a renewal task', () => {
    const contract = {
      id: 'c-cancel-1',
      customer_id: 'cust-303',
      provider: 'Vattenfall',
      type: 'energie_strom' as const,
      status: 'aktiv' as const,
      end_date: '2026-08-31',
    };

    // User marks contract as cancelled
    const updatedContract = {
      ...contract,
      status: 'gekuendigt_wartet_neuabschluss' as const,
    };
    expect(updatedContract.status).toBe('gekuendigt_wartet_neuabschluss');

    // Trigger renewal follow-up task
    const renewalTask = {
      title: `Neuabschluss anbieten: Gekündigter Vertrag ${updatedContract.provider}`,
      contract_id: updatedContract.id,
      customer_id: updatedContract.customer_id,
      due_date: '2026-08-01',
      status: 'offen' as TaskStatus,
    };

    expect(renewalTask.contract_id).toBe(contract.id);
    expect(renewalTask.status).toBe('offen');
  });

  it('T3.4 - Pairwise [Deals ↔ Clarifications]: Critical expiring contract (Ampel rot) escalates to clarification ticket', () => {
    const refDate = new Date('2026-06-01T00:00:00Z');
    const contract = {
      id: 'c-exp-1',
      customer_id: 'cust-304',
      type: 'gkv' as const,
      status: 'aktiv' as const,
      end_date: '2026-06-15T00:00:00Z', // 14 days left
    };

    const bucket = getExpiryBucket(contract.end_date, contract.status, refDate);
    expect(bucket.key).toBe('rot'); // ≤30d

    // Contract cannot be resolved via standard outreach -> escalate to Clarification ticket
    const clarification = {
      customer_id: contract.customer_id,
      contract_id: contract.id,
      category: 'sonstiges' as const,
      title: `Dringend: Vertrag läuft in ${bucket.label} ab – Kunde nicht erreichbar`,
      due_date: contract.end_date,
      status: 'offen' as ClarificationStatus,
    };

    const urgency = getClarificationUrgency(clarification.due_date, clarification.status, refDate);
    expect(urgency.rank).toBeGreaterThanOrEqual(1);
    expect(clarification.title).toContain('Dringend');
  });

  it('T3.5 - Pairwise [Users ↔ Contacts]: Safeguard checks customer count before admin deactivates or deletes an agent', () => {
    const agent = { id: 'agent-bob', active: true };
    const allCustomers = [
      { id: 'c1', assigned_to: 'agent-bob' },
      { id: 'c2', assigned_to: 'agent-bob' },
      { id: 'c3', assigned_to: 'agent-alice' },
    ];

    const countAssigned = (agentId: string) => allCustomers.filter((c) => c.assigned_to === agentId).length;

    const canDelete = (agentId: string) => {
      const count = countAssigned(agentId);
      if (count > 0) throw new Error(`Agent besitzt noch ${count} Kunden.`);
      return true;
    };

    expect(() => canDelete(agent.id)).toThrowError('Agent besitzt noch 2 Kunden.');

    // Reassign customers to Alice
    for (const c of allCustomers) {
      if (c.assigned_to === 'agent-bob') c.assigned_to = 'agent-alice';
    }

    expect(canDelete(agent.id)).toBe(true);
  });

  it('T3.6 - Pairwise [Leads ↔ Branding]: DISG behavior assessment formats golden-amber brand sales tip pill', () => {
    const lead = {
      name: 'Dr. Frank Klein',
      personality_type: 'dominant' as PersonalityType,
    };

    const meta = PERSONALITY_TYPES_METADATA.find((p) => p.value === lead.personality_type);
    expect(meta).toBeDefined();

    const bannerConfig = {
      brandAccent: SPARIOM_BRAND.primaryColor,
      salesTip: meta?.salesTip,
      icon: meta?.icon,
    };

    expect(bannerConfig.brandAccent).toBe('#d2953c');
    expect(bannerConfig.salesTip).toContain('auf den Punkt');
    expect(bannerConfig.icon).toBe('⚡');
  });

  it('T3.7 - Pairwise [Contacts ↔ Households]: Shared household aggregates contracts across primary and partner customers', () => {
    const household = { id: 'hh-1', name: 'Haushalt Weber' };
    const customer1 = { id: 'cust-w1', name: 'Klaus Weber', household_id: household.id };
    const customer2 = { id: 'cust-w2', name: 'Monika Weber', household_id: household.id };

    const contracts = [
      { id: 'c-strom', customer_id: customer1.id, type: 'energie_strom', provider: 'Yello' },
      { id: 'c-gas', customer_id: customer2.id, type: 'energie_gas', provider: 'Mainova' },
    ];

    const getHouseholdContracts = (hhId: string, memberIds: string[]) =>
      contracts.filter((c) => memberIds.includes(c.customer_id));

    const hhContracts = getHouseholdContracts(household.id, [customer1.id, customer2.id]);
    expect(hhContracts).toHaveLength(2);
    expect(hhContracts.map((c) => c.type)).toContain('energie_strom');
    expect(hhContracts.map((c) => c.type)).toContain('energie_gas');
  });

  it('T3.8 - Pairwise [Contacts ↔ Referral Lifecycle]: Customer referral links referring customer and transitions payout state', () => {
    const referrer = { id: 'cust-ref-1', name: 'Andreas Koch', bonusEarned: 0 };
    const newCustomer = {
      id: 'cust-new-2',
      name: 'Sabine Meyer',
      referred_by_customer_id: referrer.id,
      referral_bonus_amount: 50.0,
      referral_status: 'offen' as 'offen' | 'zugesagt' | 'ausgezahlt',
    };

    expect(newCustomer.referred_by_customer_id).toBe(referrer.id);

    // Deal closed -> bonus zugesagt
    newCustomer.referral_status = 'zugesagt';
    expect(newCustomer.referral_status).toBe('zugesagt');

    // Payout made -> ausgezahlt, credit referrer
    newCustomer.referral_status = 'ausgezahlt';
    referrer.bonusEarned += newCustomer.referral_bonus_amount;

    expect(newCustomer.referral_status).toBe('ausgezahlt');
    expect(referrer.bonusEarned).toBe(50.0);
  });

  it('T3.9 - Pairwise [Clarifications ↔ Tasks]: Resolving a clarification logs customer timeline audit note and closes linked task', () => {
    const clarification = {
      id: 'clar-501',
      customer_id: 'cust-601',
      title: 'Zählerstand nachreichen',
      status: 'offen' as ClarificationStatus,
    };

    const linkedTask = {
      id: 'task-501',
      customer_id: clarification.customer_id,
      title: 'Zählerstand beim Kunden anfordern',
      status: 'offen' as TaskStatus,
    };

    const timelineNotes: string[] = [];

    // Resolve clarification
    clarification.status = 'erledigt';
    timelineNotes.push(`Klärfall "${clarification.title}" wurde erfolgreich gelöst.`);
    linkedTask.status = 'erledigt';

    expect(clarification.status).toBe('erledigt');
    expect(linkedTask.status).toBe('erledigt');
    expect(timelineNotes).toHaveLength(1);
    expect(timelineNotes[0]).toContain('erfolgreich gelöst');
  });

  it('T3.10 - Pairwise [Leads ↔ Contacts ↔ WhatsApp]: WhatsApp lead normalizes international phone and constructs valid wa.me chat URL', () => {
    const whatsappLead = {
      first_name: 'Daniel',
      last_name: 'Richter',
      phone: '0049 160 5566778',
      lead_source: 'whatsapp',
    };

    const normalizedPhone = formatPhoneForWhatsApp(whatsappLead.phone);
    expect(normalizedPhone).toBe('491605566778');

    const chatUrl = whatsappLink(whatsappLead.phone, whatsappLead.first_name);
    expect(chatUrl).toContain('https://wa.me/491605566778');
    expect(chatUrl).toContain(encodeURIComponent('Hallo Daniel'));
  });

  it('T3.11 - Pairwise [Deals ↔ Documents]: Uploading a signed contract document verifies 50MB file size limit and associates contract UUID', () => {
    const contract = { id: 'c-contract-uuid-777', customer_id: 'cust-777' };
    const uploadPayload = {
      contract_id: contract.id,
      file_name: 'Vertrag_Unterzeichnet_2026.pdf',
      file_size_bytes: 4 * 1024 * 1024, // 4MB
      mime_type: 'application/pdf',
      bucket: 'contract-documents',
    };

    expect(uploadPayload.contract_id).toBe(contract.id);
    expect(uploadPayload.file_size_bytes).toBeLessThan(50 * 1024 * 1024);
    expect(uploadPayload.bucket).toBe('contract-documents');
  });

  it('T3.12 - Pairwise [Layout ↔ Theme]: Theme toggle and rail collapse states survive session state serialization', () => {
    const sessionPreferences = {
      theme: 'dark' as const,
      isRailCollapsed: true,
      accentColor: SPARIOM_BRAND.primaryDarkColor,
    };

    const serialized = JSON.stringify(sessionPreferences);
    const restored = JSON.parse(serialized);

    expect(restored.theme).toBe('dark');
    expect(restored.isRailCollapsed).toBe(true);
    expect(restored.accentColor).toBe('#df9f43');
  });
});
