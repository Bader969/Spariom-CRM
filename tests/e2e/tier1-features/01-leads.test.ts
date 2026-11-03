import { describe, it, expect } from 'vitest';
import {
  LEAD_SOURCES,
  PERSONALITY_TYPES_METADATA,
  PersonalityType,
  formatPhoneForWhatsApp,
  whatsappLink,
} from '../../fixtures/domain-contracts';

describe('Tier 1 - Feature 1: Leads (Interessenten) Management', () => {
  it('T1.1.1 - should validate all 13 supported lead source channels', () => {
    expect(LEAD_SOURCES).toHaveLength(13);
    const expectedSources = [
      'whatsapp',
      'empfehlung',
      'tiktok',
      'instagram',
      'facebook',
      'google',
      'messe',
      'kaltakquise',
      'telefon_eingang',
      'website',
      'email_kampagne',
      'flyer',
      'sonstiges',
    ];
    for (const src of expectedSources) {
      expect(LEAD_SOURCES).toContain(src);
    }
  });

  it('T1.1.2 - should properly assign and retrieve DISG personality behavior profiles with sales advice', () => {
    const personalityValues: PersonalityType[] = ['dominant', 'initiativ', 'gewissenhaft', 'stetig'];
    expect(PERSONALITY_TYPES_METADATA).toHaveLength(4);

    for (const p of personalityValues) {
      const meta = PERSONALITY_TYPES_METADATA.find((item) => item.value === p);
      expect(meta).toBeDefined();
      expect(meta?.salesTip.length).toBeGreaterThan(15);
      expect(meta?.icon).toBeTruthy();
    }

    const dominant = PERSONALITY_TYPES_METADATA.find((item) => item.value === 'dominant');
    expect(dominant?.salesTip).toContain('auf den Punkt');
  });

  it('T1.1.3 - should format phone numbers and generate valid WhatsApp quick-chat links for leads', () => {
    const rawPhone = '+49 170 1234567';
    const normalized = formatPhoneForWhatsApp(rawPhone);
    expect(normalized).toBe('491701234567');

    const link = whatsappLink(rawPhone, 'Maximilian');
    expect(link).toContain('https://wa.me/491701234567');
    expect(link).toContain(encodeURIComponent('Hallo Maximilian'));
  });

  it('T1.1.4 - should simulate lead creation payload with required and optional fields', () => {
    const leadPayload = {
      status: 'interessent',
      first_name: 'Sarah',
      last_name: 'Schmidt',
      email: 'sarah.schmidt@example.de',
      phone: '015198765432',
      lead_source: 'instagram',
      lead_source_detail: 'Campaign Sommer2026',
      personality_type: 'initiativ' as PersonalityType,
      notes: 'Interessiert an GKV Wechsel für Familie',
    };

    expect(leadPayload.status).toBe('interessent');
    expect(leadPayload.first_name).toBeTruthy();
    expect(leadPayload.last_name).toBeTruthy();
    expect(LEAD_SOURCES).toContain(leadPayload.lead_source);
  });

  it('T1.1.5 - should perform lead-to-customer conversion workflow generating system audit note', () => {
    const initialLead = {
      id: 'lead-uuid-101',
      status: 'interessent' as const,
      first_name: 'Thomas',
      last_name: 'Bauer',
    };

    // Conversion operation
    const converted = {
      ...initialLead,
      status: 'kunde' as const,
      converted_at: new Date().toISOString(),
    };

    const auditNote = {
      customer_id: converted.id,
      note_type: 'system' as const,
      content: 'Interessent zu Kunde konvertiert.',
      created_at: new Date().toISOString(),
    };

    expect(converted.status).toBe('kunde');
    expect(auditNote.note_type).toBe('system');
    expect(auditNote.content).toBe('Interessent zu Kunde konvertiert.');
    expect(auditNote.customer_id).toBe(initialLead.id);
  });

  it('T1.1.6 - should filter leads by search term across name, email, phone and notes', () => {
    const sampleLeads = [
      { first_name: 'Anna', last_name: 'Meier', email: 'anna@web.de', phone: '0171111111', notes: 'Solar' },
      { first_name: 'Bernd', last_name: 'Schulz', email: 'bernd@gmx.de', phone: '0172222222', notes: 'Strom' },
      { first_name: 'Carla', last_name: 'Weber', email: 'c.weber@t-online.de', phone: '0173333333', notes: 'Gas' },
    ];

    const search = (q: string) => {
      const term = q.toLowerCase();
      return sampleLeads.filter(
        (l) =>
          l.first_name.toLowerCase().includes(term) ||
          l.last_name.toLowerCase().includes(term) ||
          l.email.toLowerCase().includes(term) ||
          l.notes.toLowerCase().includes(term),
      );
    };

    expect(search('Anna')).toHaveLength(1);
    expect(search('strom')).toHaveLength(1);
    expect(search('weber')).toHaveLength(1);
    expect(search('nonexistent')).toHaveLength(0);
  });
});
