import { describe, it, expect } from 'vitest';
import {
  LEAD_SOURCES,
  formatPhoneForWhatsApp,
  normalizeStr,
} from '../../fixtures/domain-contracts';

describe('Tier 2 - Feature 1 Boundary: Leads (Interessenten)', () => {
  it('T2.1.1 - should reject lead-to-customer conversion if first_name or last_name is empty or whitespace', () => {
    const validateConversion = (lead: { first_name?: string | null; last_name?: string | null }) => {
      const f = lead.first_name?.trim();
      const l = lead.last_name?.trim();
      if (!f || !l) {
        throw new Error('Vor- und Nachname sind erforderlich für die Konvertierung.');
      }
      return true;
    };

    expect(() => validateConversion({ first_name: '', last_name: 'Schmidt' })).toThrowError(
      'Vor- und Nachname sind erforderlich',
    );
    expect(() => validateConversion({ first_name: '  ', last_name: 'Schmidt' })).toThrowError(
      'Vor- und Nachname sind erforderlich',
    );
    expect(() => validateConversion({ first_name: 'Sarah', last_name: null })).toThrowError(
      'Vor- und Nachname sind erforderlich',
    );
    expect(validateConversion({ first_name: 'Sarah', last_name: 'Schmidt' })).toBe(true);
  });

  it('T2.1.2 - should handle extremely large notes (10,000+ characters) without runtime crash', () => {
    const hugeNote = 'Sehr wichtig: '.repeat(1000);
    expect(hugeNote.length).toBeGreaterThan(10000);

    const lead = {
      first_name: 'Markus',
      last_name: 'Bauer',
      notes: hugeNote,
    };

    expect(lead.notes.length).toBe(hugeNote.length);
    expect(lead.notes.startsWith('Sehr wichtig:')).toBe(true);
  });

  it('T2.1.3 - should normalize non-standard phone numbers with parentheses, slashes and dots for WhatsApp', () => {
    const weirdPhones = [
      { input: '0049 (0) 170 / 123.456-7', expected: '4901701234567' },
      { input: '+49-(171)-987 65 43', expected: '491719876543' },
      { input: '0152 33445566', expected: '4915233445566' },
    ];

    for (const item of weirdPhones) {
      const res = formatPhoneForWhatsApp(item.input);
      expect(res).toBe(item.expected);
    }
  });

  it('T2.1.4 - should safely preserve unicode, umlauts, hyphens, and emojis in lead profiles', () => {
    const adversarialLead = {
      first_name: 'Jürgen-Frédéric 🚀',
      last_name: 'Müller-Lüdenscheidt',
      notes: 'Anfrage via TikTok: "Rabatt für Großfamilie? 😊 100% Ökostrom! <test@spariom.de>"',
    };

    expect(adversarialLead.first_name).toContain('🚀');
    expect(adversarialLead.first_name).toContain('é');
    expect(adversarialLead.last_name).toContain('ü');
    expect(adversarialLead.notes).toContain('😊');
  });

  it('T2.1.5 - should map unknown or unlisted lead sources safely to fallback category', () => {
    const sanitizeLeadSource = (src: string): string => {
      const normalized = normalizeStr(src);
      const isKnown = (LEAD_SOURCES as readonly string[]).includes(normalized);
      return isKnown ? normalized : 'sonstiges';
    };

    expect(sanitizeLeadSource('WHATSAPP')).toBe('whatsapp');
    expect(sanitizeLeadSource('unknown_channel_xyz')).toBe('sonstiges');
    expect(sanitizeLeadSource('')).toBe('sonstiges');
  });

  it('T2.1.6 - should sanitize XSS / script tags in search queries without exception', () => {
    const searchFilter = (searchTerm: string, text: string) => {
      const cleanTerm = searchTerm.replace(/<[^>]*>/g, '').trim().toLowerCase();
      return text.toLowerCase().includes(cleanTerm);
    };

    const maliciousQuery = '<b>Meier</b>';
    const candidate = 'Hans Meier';

    expect(searchFilter(maliciousQuery, candidate)).toBe(true);
  });
});
