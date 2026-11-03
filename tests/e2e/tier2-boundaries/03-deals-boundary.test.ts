import { describe, it, expect } from 'vitest';
import { detectDuplicates, getExpiryBucket } from '../../fixtures/domain-contracts';

describe('Tier 2 - Feature 3 Boundary: Deals (Verträge) & Renewals', () => {
  it('T2.3.1 - should ignore scientific notation reference numbers in duplicate detection', () => {
    const contracts = [
      {
        id: 'c1',
        customer_id: 'cust-1',
        type: 'energie_strom',
        referenz_id: '9.00034e+11', // corrupt Excel scientific notation
      },
      {
        id: 'c2',
        customer_id: 'cust-1',
        type: 'energie_strom',
        referenz_id: '9.00034e+11',
      },
    ];

    const dupes = detectDuplicates(contracts);
    expect(dupes.size).toBe(0);
  });

  it('T2.3.2 - should ignore trivial or short meter numbers (≤3 characters) in duplicate detection', () => {
    const contracts = [
      {
        id: 'c1',
        customer_id: 'cust-1',
        type: 'energie_strom',
        details: { zaehlernummer: '123' }, // short placeholder
      },
      {
        id: 'c2',
        customer_id: 'cust-1',
        type: 'energie_strom',
        details: { zaehlernummer: '123' },
      },
    ];

    const dupes = detectDuplicates(contracts);
    expect(dupes.size).toBe(0);
  });

  it('T2.3.3 - should never flag identical contracts across different customers as duplicates', () => {
    const contracts = [
      {
        id: 'c1',
        customer_id: 'cust-A',
        type: 'energie_strom',
        provider: 'E.ON',
        referenz_id: 'GLOBAL-REF-100',
        details: { zaehlernummer: '1EMH0099887766' },
      },
      {
        id: 'c2',
        customer_id: 'cust-B', // Different customer!
        type: 'energie_strom',
        provider: 'E.ON',
        referenz_id: 'GLOBAL-REF-100',
        details: { zaehlernummer: '1EMH0099887766' },
      },
    ];

    const dupes = detectDuplicates(contracts);
    expect(dupes.size).toBe(0);
  });

  it('T2.3.4 - should test exact day boundaries for Ampel buckets (30d vs 31d, 90d vs 91d)', () => {
    const ref = new Date('2026-06-01T00:00:00Z');

    // Exactly 30 days -> rot
    const d30 = new Date(ref.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(getExpiryBucket(d30, 'aktiv', ref).key).toBe('rot');

    // 31 days -> orange
    const d31 = new Date(ref.getTime() + 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(getExpiryBucket(d31, 'aktiv', ref).key).toBe('orange');

    // Exactly 90 days -> orange
    const d90 = new Date(ref.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    expect(getExpiryBucket(d90, 'aktiv', ref).key).toBe('orange');

    // 91 days -> gelb
    const d91 = new Date(ref.getTime() + 91 * 24 * 60 * 60 * 1000).toISOString();
    expect(getExpiryBucket(d91, 'aktiv', ref).key).toBe('gelb');
  });

  it('T2.3.5 - should map null or undefined end_date to neutral bucket with rank 0', () => {
    const neutralBucket = getExpiryBucket(null, 'aktiv');
    expect(neutralBucket.key).toBe('neutral');
    expect(neutralBucket.rank).toBe(0);
    expect(neutralBucket.label).toBe('Ohne Datum');
  });

  it('T2.3.6 - should verify contract status abgelaufen forces abgelaufen bucket even if end_date is in future', () => {
    const futureDate = '2099-12-31T00:00:00Z';
    const bucket = getExpiryBucket(futureDate, 'abgelaufen');
    expect(bucket.key).toBe('abgelaufen');
    expect(bucket.rank).toBe(5);
  });
});
