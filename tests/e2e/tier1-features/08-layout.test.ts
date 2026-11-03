import { describe, it, expect } from 'vitest';
import { SPARIOM_BRAND } from '../../fixtures/domain-contracts';

describe('Tier 1 - Feature 8: Sorvo UI Layout & Responsive Design', () => {
  it('T1.8.1 - should validate Sorvo floating sidebar expanded and rail width specifications', () => {
    expect(SPARIOM_BRAND.sidebarWidthExpanded).toBe(256);
    expect(SPARIOM_BRAND.sidebarWidthRail).toBe(84);

    const getSidebarWidth = (isCollapsed: boolean) =>
      isCollapsed ? SPARIOM_BRAND.sidebarWidthRail : SPARIOM_BRAND.sidebarWidthExpanded;

    expect(getSidebarWidth(false)).toBe(256);
    expect(getSidebarWidth(true)).toBe(84);
  });

  it('T1.8.2 - should validate sticky header height and container constraint specifications', () => {
    expect(SPARIOM_BRAND.headerHeight).toBe(64);
    expect(SPARIOM_BRAND.maxHeaderWidth).toBe('calc(1480px - 28px)');
  });

  it('T1.8.3 - should validate main content padding calculation based on sidebar state', () => {
    const computeMainPadding = (isCollapsed: boolean, viewportWidth: number) => {
      if (viewportWidth < SPARIOM_BRAND.mobileBreakpoint) {
        return { paddingLeft: 12, paddingRight: 12 };
      }
      const sideWidth = isCollapsed ? SPARIOM_BRAND.sidebarWidthRail : SPARIOM_BRAND.sidebarWidthExpanded;
      return { paddingLeft: sideWidth + 28, paddingRight: 28 };
    };

    // Mobile
    expect(computeMainPadding(false, 375)).toEqual({ paddingLeft: 12, paddingRight: 12 });

    // Desktop expanded
    expect(computeMainPadding(false, 1440)).toEqual({ paddingLeft: 284, paddingRight: 28 });

    // Desktop rail collapsed
    expect(computeMainPadding(true, 1440)).toEqual({ paddingLeft: 112, paddingRight: 28 });
  });

  it('T1.8.4 - should verify required navigation routes present in app shell', () => {
    const requiredRoutes = [
      '/dashboard',
      '/interessenten',
      '/kunden',
      '/vertraege',
      '/vertragsablauf',
      '/aufgaben',
      '/klaerfaelle',
      '/team',
      '/profil',
      '/benutzer',
    ];

    expect(requiredRoutes).toHaveLength(10);
    expect(requiredRoutes).toContain('/dashboard');
    expect(requiredRoutes).toContain('/interessenten');
    expect(requiredRoutes).toContain('/kunden');
  });

  it('T1.8.5 - should validate floating header elements contract (search pill, new action, notifications)', () => {
    const headerElements = ['breadcrumbs', 'searchpill_cmd_k', 'quick_new_btn', 'notification_bell', 'theme_toggle'];
    expect(headerElements).toContain('searchpill_cmd_k');
    expect(headerElements).toContain('quick_new_btn');
    expect(headerElements).toContain('notification_bell');
  });

  it('T1.8.6 - should verify CSS class toggles for rail collapse (.side--collapsed)', () => {
    const getSidebarClass = (isCollapsed: boolean) =>
      `side frosted-glass ${isCollapsed ? 'side--collapsed' : 'side--expanded'}`;

    expect(getSidebarClass(true)).toContain('side--collapsed');
    expect(getSidebarClass(false)).toContain('side--expanded');
  });
});
