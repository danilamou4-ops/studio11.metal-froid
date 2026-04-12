import { NextResponse } from "next/server";

import { getAuthenticatedUser, getUserTeamRole } from "@/lib/auth/route-auth";

export async function GET() {
  try {
    const { user } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    const role = await getUserTeamRole(user.id, user.email ?? null);

    return NextResponse.json({
      data: {
        userId: user.id,
        role,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "TEAM_ROLE_FETCH_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 },
    );
  }
}
