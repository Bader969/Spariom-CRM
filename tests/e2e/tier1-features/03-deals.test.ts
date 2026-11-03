import { describe, it, expect } from 'vitest';
import {
  CONTRACT_TYPES,
  CONTRACT_STATUSES,
  detectDuplicates,
  getExpiryBucket,
  ContractType,
  ContractStatus,
} from '../../fixtures/domain-contracts';

describe('Tier 1 - Feature 3: Deals (Verträge) & Renewals', () => {
  it('T1.3.1 - should validate all 6 contract types and their labels', () => {
    expect(CONTRACT_TYPES).toHaveLength(6);
    const expectedTypes: ContractType[] = [
      'energie_strom',
      'energie_gas',
      'gkv',
      'pkv',
      'telekommunikation',
      'kfz',
    ];
    for (const t of expectedTypes) {
      const match = CONTRACT_TYPES.find((c) => c.value === t);
      expect(match).toBeDefined();
      expect(match?.label).toBeTruthy();
    }
  });

  it('T1.3.2 - should validate the 5 Kanban pipeline status columns', () => {
    expect(CONTRACT_STATUSES).toHaveLength(5);
    const expectedStatuses: ContractStatus[] = [
      'in_pruefung',
      'aktiv',
      'gekuendigt_wartet_neuabschluss',
      'abgelaufen',
      'storniert',
    ];
    for (const s of expectedStatuses) {
      const match = CONTRACT_STATUSES.find((st) => st.value === s);
      expect(match).toBeDefined();
    }
  });

  it('T1.3.3 - should detect high-severity duplicate with identical referenz_id within same customer', () => {
    const contracts = [
      {
        id: 'c1',
        customer_id: 'cust-1',
        type: 'energie_strom',
        provider: 'E.ON',
        referenz_id: 'REF-998877',
        status: 'aktiv',
      },
      {
        id: 'c2',
        customer_id: 'cust-1',
        type: 'energie_strom',
        provider: 'E.ON',
        referenz_id: 'REF-998877',
        status: 'in_pruefung',
      },
    ];

    const dupes = detectDuplicates(contracts);
    expect(dupes.size).toBe(2);
    expect(dupes.get('c1')?.isDuplicate).toBe(true);
    expect(dupes.get('c1')?.severity).toBe('high');
    expect(dupes.get('c1')?.primaryReason).toContain('Identische Auftrags-/Referenz-ID');
    expect(dupes.get('c1')?.partnerIds).toContain('c2');
  });

  it('T1.3.4 - should detect high-severity duplicate with identical zaehlernummer in energy contracts', () => {
    const contracts = [
      {
        id: 'c10',
        customer_id: 'cust-2',
        type: 'energie_strom',
        provider: 'Vattenfall',
        details: { zaehlernummer: '1EMH0009876543' },
        status: 'aktiv',
      },
      {
        id: 'c11',
        customer_id: 'cust-2',
        type: 'energie_strom',
        provider: 'Yello',
        details: { zaehlernummer: '1EMH0009876543' },
        status: 'in_pruefung',
      },
    ];

    const dupes = detectDuplicates(contracts);
    expect(dupes.size).toBe(2);
    expect(dupes.get('c10')?.severity).toBe('high');
    expect(dupes.get('c10')?.primaryReason).toContain('Identische Zählernummer');
  });

  it('T1.3.5 - should calculate Ampel renewal buckets based on days remaining', () => {
    const refDate = new Date('2026-06-01T00:00:00Z');

    // ≤30d -> rot (rank 4)
    const bucketRot = getExpiryBucket('2026-06-20T00:00:00Z', 'aktiv', refDate);
    expect(bucketRot.key).toBe('rot');
    expect(bucketRot.rank).toBe(4);

    // ≤90d -> orange (rank 3)
    const bucketOrange = getExpiryBucket('2026-08-15T00:00:00Z', 'aktiv', refDate);
    expect(bucketOrange.key).toBe('orange');
    expect(bucketOrange.rank).toBe(3);

    // ≤180d -> gelb (rank 2)
    const bucketGelb = getExpiryBucket('2026-10-15T00:00:00Z', 'aktiv', refDate);
    expect(bucketGelb.key).toBe('gelb');
    expect(bucketGelb.rank).toBe(2);

    // ≤365d -> gruen (rank 1)
    const bucketGruen = getExpiryBucket('2027-02-01T00:00:00Z', 'aktiv', refDate);
    expect(bucketGruen.key).toBe('gruen');
    expect(bucketGruen.rank).toBe(1);

    // Past date -> abgelaufen (rank 5)
    const bucketPast = getExpiryBucket('2026-05-01T00:00:00Z', 'aktiv', refDate);
    expect(bucketPast.key).toBe('abgelaufen');
    expect(bucketPast.rank).toBe(5);
  });

  it('T1.3.6 - should detect medium-severity duplicate for two simultaneously active contracts with same provider', () => {
    const contracts = [
      {
        id: 'c20',
        customer_id: 'cust-3',
        type: 'energie_gas',
        provider: 'Mainova',
        status: 'aktiv',
      },
      {
        id: 'c21',
        customer_id: 'cust-3',
        type: 'energie_gas',
        provider: 'Mainova',
        status: 'aktiv',
      },
    ];

    const dupes = detectDuplicates(contracts);
    expect(dupes.size).toBe(2);
    expect(dupes.get('c20')?.severity).toBe('medium');
    expect(dupes.get('c20')?.primaryReason).toContain('zeitgleich aktive Verträge');
  });
});
