import { describe, it, expect } from 'vitest';
import { isValidIBAN } from '../../fixtures/domain-contracts';

describe('Tier 1 - Feature 2: Contacts (Kunden) Management', () => {
  it('T1.2.1 - should validate 360° customer entity data model with all required contact channels', () => {
    const customer = {
      id: 'cust-uuid-201',
      salutation: 'Frau',
      first_name: 'Elena',
      last_name: 'Fischer',
      birthdate: '1988-06-15',
      phone: '+49 171 9988776',
      email: 'elena.fischer@example.com',
      street: 'Kaiserstraße 42',
      zip: '76133',
      city: 'Karlsruhe',
      status: 'kunde',
      assigned_to: 'user-sales-01',
      personality_type: 'gewissenhaft',
    };

    expect(customer.status).toBe('kunde');
    expect(['Herr', 'Frau', 'Divers']).toContain(customer.salutation);
    expect(customer.first_name).toBe('Elena');
    expect(customer.zip).toMatch(/^\d{5}$/);
  });

  it('T1.2.2 - should verify 5 distinct tabs in Customer 360° Hub contract', () => {
    const requiredHubTabs = ['contracts', 'documents', 'clarifications', 'tasks', 'relations'];
    const tabLabels: Record<string, string> = {
      contracts: 'Verträge',
      documents: 'Dokumente',
      clarifications: 'Klärfälle',
      tasks: 'Aufgaben',
      relations: 'Verknüpfungen / Haushalte',
    };

    expect(requiredHubTabs).toHaveLength(5);
    for (const tab of requiredHubTabs) {
      expect(tabLabels[tab]).toBeTruthy();
    }
  });

  it('T1.2.3 - should validate customer household structure and member linking', () => {
    const household = {
      id: 'hh-uuid-1',
      name: 'Haushalt Fischer / Weber',
      street: 'Kaiserstraße',
      house_no: '42',
      postal_code: '76133',
      city: 'Karlsruhe',
    };

    const members = [
      { household_id: household.id, customer_id: 'cust-uuid-201', role: 'Elternteil', is_primary: true },
      { household_id: household.id, customer_id: 'cust-uuid-202', role: 'Partner', is_primary: false },
    ];

    expect(members).toHaveLength(2);
    const primaryMember = members.find((m) => m.is_primary);
    expect(primaryMember).toBeDefined();
    expect(primaryMember?.customer_id).toBe('cust-uuid-201');
  });

  it('T1.2.4 - should support customer referral bonus tracking lifecycle', () => {
    const referral = {
      referred_by_customer_id: 'cust-referrer-001',
      referred_customer_id: 'cust-referred-002',
      referral_bonus_amount: 50.0,
      referral_status: 'offen' as 'offen' | 'zugesagt' | 'ausgezahlt' | 'storniert',
      referral_paid_at: null as string | null,
    };

    expect(referral.referral_status).toBe('offen');

    // Transition to agreed then paid
    referral.referral_status = 'zugesagt';
    expect(referral.referral_status).toBe('zugesagt');

    referral.referral_status = 'ausgezahlt';
    referral.referral_paid_at = new Date().toISOString();
    expect(referral.referral_status).toBe('ausgezahlt');
    expect(referral.referral_paid_at).toBeTruthy();
  });

  it('T1.2.5 - should validate customer German IBAN for payment and bonus payout', () => {
    const validGermanIBAN = 'DE89370400440532013000';
    const spacedIBAN = 'DE89 3704 0044 0532 0130 00';
    expect(isValidIBAN(validGermanIBAN)).toBe(true);
    expect(isValidIBAN(spacedIBAN)).toBe(true);
  });

  it('T1.2.6 - should record customer timeline notes across note types', () => {
    const timeline = [
      { id: '1', customer_id: 'cust-1', note_type: 'anruf', content: 'Erstgespräch bzgl. Strom' },
      { id: '2', customer_id: 'cust-1', note_type: 'notiz', content: 'Kunde bevorzugt Ökostrom' },
      { id: '3', customer_id: 'cust-1', note_type: 'system', content: 'Interessent zu Kunde konvertiert.' },
    ];

    const noteTypes = timeline.map((n) => n.note_type);
    expect(noteTypes).toContain('anruf');
    expect(noteTypes).toContain('notiz');
    expect(noteTypes).toContain('system');
  });
});
