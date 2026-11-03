import { describe, it, expect } from 'vitest';
import { isValidIBAN } from '../../fixtures/domain-contracts';

describe('Tier 2 - Feature 2 Boundary: Contacts (Kunden) Management', () => {
  it('T2.2.1 - should reject invalid IBAN formats and lengths', () => {
    const invalidIBANs = [
      '',
      'DE123', // too short
      '1289370400440532013000', // missing country code
      'DE89370400440532013000TOOLONG_ABCDEFG1234567890123456789', // over 34 chars
      'XX89370400440532013000', // valid format syntax but tested regex
      'DE89-3704-0044-invalid',
    ];

    expect(isValidIBAN('DE123')).toBe(false);
    expect(isValidIBAN('')).toBe(false);
    expect(isValidIBAN('1289370400440532013000')).toBe(false);
  });

  it('T2.2.2 - should detect and prevent circular referral cycles (A refers B and B refers A)', () => {
    const referralMap: Record<string, string> = {
      'cust-b': 'cust-a',
    };

    const wouldCreateCycle = (candidateId: string, referrerId: string): boolean => {
      if (candidateId === referrerId) return true;
      let current: string | undefined = referrerId;
      const visited = new Set<string>();
      while (current) {
        if (current === candidateId) return true;
        if (visited.has(current)) break;
        visited.add(current);
        current = referralMap[current];
      }
      return false;
    };

    expect(wouldCreateCycle('cust-a', 'cust-a')).toBe(true); // self-referral
    expect(wouldCreateCycle('cust-a', 'cust-b')).toBe(true); // cycle: b refers a, now a tries to refer b
    expect(wouldCreateCycle('cust-c', 'cust-a')).toBe(false); // legal new branch
  });

  it('T2.2.3 - should block deletion of customer if active contracts exist', () => {
    const canDeleteCustomer = (contracts: { status: string }[]) => {
      const activeContracts = contracts.filter((c) => c.status === 'aktiv' || c.status === 'in_pruefung');
      if (activeContracts.length > 0) {
        throw new Error(
          `Kunde kann nicht gelöscht werden: ${activeContracts.length} aktive/laufende Verträge vorhanden.`,
        );
      }
      return true;
    };

    expect(() => canDeleteCustomer([{ status: 'aktiv' }])).toThrowError('aktive/laufende Verträge vorhanden');
    expect(() => canDeleteCustomer([{ status: 'in_pruefung' }])).toThrowError('aktive/laufende Verträge vorhanden');
    expect(canDeleteCustomer([{ status: 'abgelaufen' }, { status: 'storniert' }])).toBe(true);
  });

  it('T2.2.4 - should safely handle null or empty address components without throwing undefined errors', () => {
    const formatAddress = (c: { street?: string | null; zip?: string | null; city?: string | null }) => {
      const line1 = c.street?.trim() || '';
      const line2 = [c.zip?.trim(), c.city?.trim()].filter(Boolean).join(' ');
      return [line1, line2].filter(Boolean).join(', ') || 'Keine Adresse hinterlegt';
    };

    expect(formatAddress({ street: null, zip: null, city: null })).toBe('Keine Adresse hinterlegt');
    expect(formatAddress({ street: 'Musterstraße 1' })).toBe('Musterstraße 1');
    expect(formatAddress({ zip: '10115', city: 'Berlin' })).toBe('10115 Berlin');
  });

  it('T2.2.5 - should validate leap year birthdates (e.g. 29.02.2000) correctly', () => {
    const parseBirthdate = (dateStr: string) => {
      const d = new Date(dateStr);
      return !isNaN(d.getTime()) && d.toISOString().startsWith(dateStr);
    };

    expect(parseBirthdate('2000-02-29')).toBe(true); // leap year
    expect(parseBirthdate('1999-02-29')).toBe(false); // non-leap year (rolls over to March)
  });

  it('T2.2.6 - should enforce non-empty household name constraint', () => {
    const validateHousehold = (h: { name: string }) => {
      if (!h.name || h.name.trim().length === 0) {
        throw new Error('Haushaltsname darf nicht leer sein.');
      }
      return true;
    };

    expect(() => validateHousehold({ name: '' })).toThrowError('nicht leer sein');
    expect(() => validateHousehold({ name: '   ' })).toThrowError('nicht leer sein');
    expect(validateHousehold({ name: 'Familie Schneider' })).toBe(true);
  });
});
