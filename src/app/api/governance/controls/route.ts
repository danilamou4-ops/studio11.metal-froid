import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAuthenticatedUser, getUserTeamRole } from '@/lib/auth/route-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getGovernanceControlState,
  setContributionSuspension,
} from '@/server/services/contribution/governanceControls';

const payloadSchema = z.object({
  suspendContributions: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

export async function GET() {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
        { status: 401 },
      );
    }

    const role = await getUserTeamRole(user.id, user.email ?? null);
    if (role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin role required.' } },
        { status: 403 },
      );
    }

    const supabase = createAdminClient();
    const control = await getGovernanceControlState(supabase);
    return NextResponse.json({ data: control });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'GOVERNANCE_CONTROL_FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
        { status: 401 },
      );
    }

    const role = await getUserTeamRole(user.id, user.email ?? null);
    if (role !== 'admin') {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin role required.' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid payload',
          },
        },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const updated = await setContributionSuspension(supabase, {
      suspended: parsed.data.suspendContributions,
      reason: parsed.data.reason,
      userId: user.id,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'GOVERNANCE_CONTROL_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 },
    );
  }
}