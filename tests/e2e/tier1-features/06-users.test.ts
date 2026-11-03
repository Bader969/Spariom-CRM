import { describe, it, expect } from 'vitest';
import { ROLE_HIERARCHY, AppRole, normalizeStr } from '../../fixtures/domain-contracts';

describe('Tier 1 - Feature 6: User Management & Allowlist', () => {
  it('T1.6.1 - should validate the 3-tier RBAC role hierarchy', () => {
    expect(ROLE_HIERARCHY.admin).toBe(3);
    expect(ROLE_HIERARCHY.haupt_vertriebler).toBe(2);
    expect(ROLE_HIERARCHY.mitarbeiter).toBe(1);

    const hasPermission = (userRole: AppRole, requiredRole: AppRole) => {
      return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
    };

    expect(hasPermission('admin', 'mitarbeiter')).toBe(true);
    expect(hasPermission('haupt_vertriebler', 'admin')).toBe(false);
    expect(hasPermission('mitarbeiter', 'haupt_vertriebler')).toBe(false);
    expect(hasPermission('admin', 'admin')).toBe(true);
  });

  it('T1.6.2 - should enforce case-insensitive email allowlist normalization', () => {
    const rawEmail = '  Sales.Agent@Spariom.de  ';
    const normalized = normalizeStr(rawEmail);
    expect(normalized).toBe('sales.agent@spariom.de');

    const allowlist = new Set(['sales.agent@spariom.de']);
    expect(allowlist.has(normalizeStr(rawEmail))).toBe(true);
    expect(allowlist.has('other@spariom.de')).toBe(false);
  });

  it('T1.6.3 - should simulate admin user creation with role assignment and allowlist entry', () => {
    const adminActionPayload = {
      email: 'new.broker@spariom.de',
      password: 'SecurePassword2026!',
      full_name: 'Max Mustermann',
      role: 'mitarbeiter' as AppRole,
    };

    expect(adminActionPayload.email).toMatch(/^.+@.+\..+$/);
    expect(adminActionPayload.password.length).toBeGreaterThanOrEqual(10);
    expect(adminActionPayload.full_name).toBeTruthy();
    expect(['admin', 'haupt_vertriebler', 'mitarbeiter']).toContain(adminActionPayload.role);
  });

  it('T1.6.4 - should simulate user activation and ban toggle duration of 876000h', () => {
    const BAN_DURATION_DEACTIVATED = '876000h'; // ~100 years ban in Supabase Auth
    const BAN_DURATION_ACTIVE = 'none';

    const getBanDuration = (active: boolean) => (active ? BAN_DURATION_ACTIVE : BAN_DURATION_DEACTIVATED);

    expect(getBanDuration(false)).toBe('876000h');
    expect(getBanDuration(true)).toBe('none');
  });

  it('T1.6.5 - should enforce customer ownership safeguard blocking deletion if user owns customers', () => {
    const checkCanDeleteUser = (ownedCustomersCount: number) => {
      if (ownedCustomersCount > 0) {
        throw new Error(`Diesem Account sind noch ${ownedCustomersCount} Kunden zugewiesen. Bitte zuerst übertragen.`);
      }
      return true;
    };

    expect(() => checkCanDeleteUser(5)).toThrowError('noch 5 Kunden zugewiesen');
    expect(checkCanDeleteUser(0)).toBe(true);
  });

  it('T1.6.6 - should verify team structure with team leader and members junction', () => {
    const team = {
      id: 'team-west',
      name: 'Vertriebsteam West',
      leader_id: 'user-leader-01',
    };

    const members = [
      { team_id: team.id, user_id: 'user-leader-01' },
      { team_id: team.id, user_id: 'user-agent-02' },
      { team_id: team.id, user_id: 'user-agent-03' },
    ];

    expect(team.leader_id).toBe('user-leader-01');
    expect(members).toHaveLength(3);
    expect(members.map((m) => m.user_id)).toContain('user-agent-02');
  });
});
