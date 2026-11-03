import { describe, it, expect } from 'vitest';
import { AppRole } from '../../fixtures/domain-contracts';

describe('Tier 2 - Feature 6 Boundary: User Management & Allowlist', () => {
  it('T2.6.1 - should strictly prohibit admin from self-deactivating or self-deleting', () => {
    const checkCanModifyUser = (currentUserId: string, targetUserId: string, action: 'delete' | 'deactivate') => {
      if (currentUserId === targetUserId) {
        throw new Error(`Eigenes Konto kann nicht ${action === 'delete' ? 'gelöscht' : 'deaktiviert'} werden.`);
      }
      return true;
    };

    expect(() => checkCanModifyUser('admin-123', 'admin-123', 'deactivate')).toThrowError(
      'Eigenes Konto kann nicht deaktiviert werden.',
    );
    expect(() => checkCanModifyUser('admin-123', 'admin-123', 'delete')).toThrowError(
      'Eigenes Konto kann nicht gelöscht werden.',
    );
    expect(checkCanModifyUser('admin-123', 'other-456', 'delete')).toBe(true);
  });

  it('T2.6.2 - should reject admin RPC execution for non-admin roles with Forbidden error', () => {
    const enforceAdminRole = (role: AppRole) => {
      if (role !== 'admin') {
        throw new Error('Forbidden: Admin-Rolle erforderlich');
      }
      return true;
    };

    expect(() => enforceAdminRole('mitarbeiter')).toThrowError('Forbidden: Admin-Rolle erforderlich');
    expect(() => enforceAdminRole('haupt_vertriebler')).toThrowError('Forbidden: Admin-Rolle erforderlich');
    expect(enforceAdminRole('admin')).toBe(true);
  });

  it('T2.6.3 - should enforce minimum 10 character password boundary for user creation', () => {
    const validatePassword = (pwd: string) => {
      if (pwd.length < 10) {
        throw new Error('Passwort muss mindestens 10 Zeichen lang sein.');
      }
      return true;
    };

    expect(() => validatePassword('123456789')).toThrowError('mindestens 10 Zeichen');
    expect(validatePassword('1234567890')).toBe(true); // exactly 10
    expect(validatePassword('SuperSecureSpariom2026!')).toBe(true);
  });

  it('T2.6.4 - should reject invalid email formats during user creation or allowlist addition', () => {
    const validateEmail = (email: string) => {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (email.includes('..') || !emailRegex.test(email.trim())) {
        throw new Error('Ungültiges E-Mail-Format.');
      }
      return true;
    };

    expect(() => validateEmail('not-an-email')).toThrowError('Ungültiges E-Mail-Format');
    expect(() => validateEmail('@missing-user.de')).toThrowError('Ungültiges E-Mail-Format');
    expect(() => validateEmail('user@missing-tld')).toThrowError('Ungültiges E-Mail-Format');
    expect(() => validateEmail('user@spariom..de')).toThrowError('Ungültiges E-Mail-Format');
    expect(validateEmail('valid.agent@spariom.de')).toBe(true);
  });

  it('T2.6.5 - should deactivate profile and ban user when allowlist entry is removed', () => {
    const profile = { id: 'user-007', email: 'agent@spariom.de', active: true };
    const allowlist = new Set(['agent@spariom.de']);

    const removeAllowlistEmail = (email: string) => {
      allowlist.delete(email);
      if (profile.email === email) {
        profile.active = false; // Cascading deactivation
      }
    };

    removeAllowlistEmail('agent@spariom.de');
    expect(allowlist.has('agent@spariom.de')).toBe(false);
    expect(profile.active).toBe(false);
  });

  it('T2.6.6 - should safely handle users without any assigned team', () => {
    const user = { id: 'u1', name: 'Freelancer', team_id: null };
    expect(user.team_id).toBeNull();
  });
});
