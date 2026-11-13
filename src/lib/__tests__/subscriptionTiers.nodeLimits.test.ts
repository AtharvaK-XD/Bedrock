import { describe, it, expect, vi, beforeEach } from 'vitest';

// Branching node limits decided 2026-11-13: Free 5, Pro 10 (Advanced = Pro), Ultimate 20; desktop app unlimited.
const platform = vi.hoisted(() => ({ desktop: false }));
vi.mock('../platform', () => ({ isDesktopApp: () => platform.desktop }));

import { TIER_LIMITS, getPlanLimits } from '../subscriptionTiers';
import { ENGINE_LIMITS } from '../workflowEngine/limits';

beforeEach(() => {
  platform.desktop = false;
});

describe('Branching node limits', () => {
  it('Free 5, Advanced and Pro 10, Ultimate 20', () => {
    expect(TIER_LIMITS.free.dagNodeLimit).toBe(5);
    expect(TIER_LIMITS.advanced.dagNodeLimit).toBe(10);
    expect(TIER_LIMITS.pro.dagNodeLimit).toBe(10);
    expect(TIER_LIMITS.ultimate.dagNodeLimit).toBe(20);
  });

  it('feature lines say the same numbers and never "unlimited" nodes', () => {
    expect(TIER_LIMITS.free.features).toContain('5 DAG canvas pipeline nodes');
    expect(TIER_LIMITS.advanced.features).toContain('10 DAG canvas pipeline nodes with branching logic');
    expect(TIER_LIMITS.pro.features).toContain('10 DAG canvas pipeline nodes with branching logic');
    expect(TIER_LIMITS.ultimate.features).toContain('20 DAG canvas pipeline nodes');
    for (const plan of Object.values(TIER_LIMITS)) {
      for (const line of plan.features) {
        if (/DAG|node/i.test(line)) expect(line, plan.name).not.toMatch(/unlimited|infinite|\b3 DAG|\b15 DAG/i);
      }
    }
  });

  it('getPlanLimits on the website follows the plan (advanced counts as Pro)', () => {
    expect(getPlanLimits(null).dagNodeLimit).toBe(5);
    expect(getPlanLimits('Free Plan').dagNodeLimit).toBe(5);
    expect(getPlanLimits('advanced').dagNodeLimit).toBe(10);
    expect(getPlanLimits('Pro Plan').dagNodeLimit).toBe(10);
    expect(getPlanLimits('Ultimate Plan').dagNodeLimit).toBe(20);
  });

  it('the desktop app keeps unlimited nodes for every plan', () => {
    platform.desktop = true;
    for (const plan of ['Free Plan', 'Pro Plan', 'Ultimate Plan']) {
      expect(getPlanLimits(plan).dagNodeLimit).toBe(Infinity);
    }
  });

  it('the workflow engine uses the same numbers', () => {
    expect(ENGINE_LIMITS.free.maxNodes).toBe(TIER_LIMITS.free.dagNodeLimit);
    expect(ENGINE_LIMITS.pro.maxNodes).toBe(TIER_LIMITS.pro.dagNodeLimit);
    expect(ENGINE_LIMITS.ultimate.maxNodes).toBe(TIER_LIMITS.ultimate.dagNodeLimit);
  });
});
