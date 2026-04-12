import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

import { setContributionSuspension } from './governanceControls';

function createSupabaseMock() {
  const controlSingleMock = vi.fn(async () => ({
    data: {
      contributions_suspended: true,
      suspended_reason: 'Maintenance',
      suspended_at: new Date().toISOString(),
      resumed_at: null,
      updated_by: 'admin_1',
    },
    error: null,
  }));

  const controlBuilder = {
    upsert: vi.fn(() => controlBuilder),
    select: vi.fn(() => controlBuilder),
    single: controlSingleMock,
  };

  const eventInsertMock = vi.fn(async () => ({ error: null }));
  const eventBuilder = {
    insert: eventInsertMock,
  };

  const fromMock = vi.fn((table: string) => {
    if (table === 'governance_controls') return controlBuilder;
    if (table === 'governance_control_events') return eventBuilder;
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    supabase: { from: fromMock } as unknown as Parameters<typeof setContributionSuspension>[0],
    controlBuilder,
    eventInsertMock,
  };
}

describe('setContributionSuspension', () => {
  it('writes rollback_suspend alias in governance event payload', async () => {
    const { supabase, eventInsertMock } = createSupabaseMock();

    await setContributionSuspension(supabase, {
      suspended: true,
      reason: 'Maintenance',
      userId: 'admin_1',
    });

    expect(eventInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'suspend_contributions',
        payload: expect.objectContaining({
          governance_action_alias: 'rollback_suspend',
          contributions_suspended: true,
        }),
      }),
    );
  });

  it('writes rollback_resume alias in governance event payload', async () => {
    const { supabase, eventInsertMock } = createSupabaseMock();

    await setContributionSuspension(supabase, {
      suspended: false,
      reason: null,
      userId: 'admin_1',
    });

    expect(eventInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'resume_contributions',
        payload: expect.objectContaining({
          governance_action_alias: 'rollback_resume',
          contributions_suspended: false,
        }),
      }),
    );
  });
});