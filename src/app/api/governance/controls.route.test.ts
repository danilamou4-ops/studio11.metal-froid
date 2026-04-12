import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthenticatedUserMock = vi.fn();
const getUserTeamRoleMock = vi.fn();
const getGovernanceControlStateMock = vi.fn();
const setContributionSuspensionMock = vi.fn();
const createAdminClientMock = vi.fn(() => ({ mocked: true }));

vi.mock('@/lib/auth/route-auth', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
  getUserTeamRole: getUserTeamRoleMock,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock('@/server/services/contribution/governanceControls', () => ({
  getGovernanceControlState: getGovernanceControlStateMock,
  setContributionSuspension: setContributionSuspensionMock,
}));

describe('GET /api/governance/controls', () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getUserTeamRoleMock.mockReset();
    getGovernanceControlStateMock.mockReset();
    createAdminClientMock.mockClear();
  });

  it('returns 401 when user is missing', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: null });

    const { GET } = await import('./controls/route');
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe('UNAUTHORIZED');
    expect(getGovernanceControlStateMock).not.toHaveBeenCalled();
  });

  it('returns 403 for non-admin users', async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      user: {
        id: 'user_1',
        email: 'member@example.com',
      },
    });
    getUserTeamRoleMock.mockResolvedValue('member');

    const { GET } = await import('./controls/route');
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('FORBIDDEN');
    expect(getGovernanceControlStateMock).not.toHaveBeenCalled();
  });

  it('returns current control state for admins', async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      user: {
        id: 'admin_1',
        email: 'admin@example.com',
      },
    });
    getUserTeamRoleMock.mockResolvedValue('admin');
    getGovernanceControlStateMock.mockResolvedValue({
      contributions_suspended: true,
      suspended_reason: 'Maintenance',
      suspended_at: new Date().toISOString(),
      resumed_at: null,
      updated_by: 'admin_1',
    });

    const { GET } = await import('./controls/route');
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.contributions_suspended).toBe(true);
    expect(getGovernanceControlStateMock).toHaveBeenCalledTimes(1);
    expect(createAdminClientMock).toHaveBeenCalledTimes(1);
  });
});

describe('PATCH /api/governance/controls', () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    getUserTeamRoleMock.mockReset();
    getGovernanceControlStateMock.mockReset();
    setContributionSuspensionMock.mockReset();
    createAdminClientMock.mockClear();
  });

  it('returns 401 when user is missing', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: null });

    const { PATCH } = await import('./controls/route');
    const request = new Request('http://localhost/api/governance/controls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspendContributions: true }),
    });

    const response = await PATCH(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe('UNAUTHORIZED');
    expect(setContributionSuspensionMock).not.toHaveBeenCalled();
  });

  it('returns 403 for non-admin users', async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      user: {
        id: 'user_1',
        email: 'member@example.com',
      },
    });
    getUserTeamRoleMock.mockResolvedValue('member');

    const { PATCH } = await import('./controls/route');
    const request = new Request('http://localhost/api/governance/controls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspendContributions: true, reason: 'Maintenance' }),
    });

    const response = await PATCH(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('FORBIDDEN');
    expect(setContributionSuspensionMock).not.toHaveBeenCalled();
  });

  it('updates suspension state for admins', async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      user: {
        id: 'admin_1',
        email: 'admin@example.com',
      },
    });
    getUserTeamRoleMock.mockResolvedValue('admin');
    setContributionSuspensionMock.mockResolvedValue({
      contributions_suspended: true,
      suspended_reason: 'Maintenance',
      suspended_at: new Date().toISOString(),
      resumed_at: null,
      updated_by: 'admin_1',
    });

    const { PATCH } = await import('./controls/route');
    const request = new Request('http://localhost/api/governance/controls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspendContributions: true, reason: 'Maintenance' }),
    });

    const response = await PATCH(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(setContributionSuspensionMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        suspended: true,
        reason: 'Maintenance',
        userId: 'admin_1',
      },
    );
    expect(createAdminClientMock).toHaveBeenCalledTimes(1);
  });
});