import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

export type TeamRole = "admin" | "member";

const DEFAULT_TEAM_SLUG = "metal-froid-core";

export function createRouteClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase public environment variables.");
  }

  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

export async function getAuthenticatedUser() {
  const supabase = createRouteClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null };
  }

  return { supabase, user };
}

async function ensureUserMembershipRole(userId: string, email: string | null | undefined) {
  if (!email) {
    return null;
  }

  const admin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();

  const { data: allowedUser, error: allowedUserError } = await admin
    .from("allowed_users")
    .select("approved,role")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (allowedUserError || !allowedUser?.approved) {
    return null;
  }

  let teamId: string | null = null;

  const { data: existingTeam, error: existingTeamError } = await admin
    .from("teams")
    .select("id")
    .eq("slug", DEFAULT_TEAM_SLUG)
    .maybeSingle();

  if (existingTeamError) {
    return null;
  }

  if (existingTeam?.id) {
    teamId = existingTeam.id;
  } else {
    const { data: createdTeam, error: createdTeamError } = await admin
      .from("teams")
      .insert({ slug: DEFAULT_TEAM_SLUG, name: "Metal Froid Core" })
      .select("id")
      .single();

    if (createdTeamError || !createdTeam?.id) {
      return null;
    }

    teamId = createdTeam.id;
  }

  const role = allowedUser.role === "admin" ? "admin" : "member";
  const { error: membershipError } = await admin
    .from("team_memberships")
    .upsert(
      {
        team_id: teamId,
        user_id: userId,
        role,
        is_active: true,
      },
      { onConflict: "team_id,user_id" },
    );

  if (membershipError) {
    return null;
  }

  return role as TeamRole;
}

export async function getUserTeamRole(userId: string, email?: string | null) {
  const supabase = createRouteClient();
  const { data, error } = await supabase
    .from("team_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error || !data?.role) {
    return ensureUserMembershipRole(userId, email);
  }

  return data.role as TeamRole;
}
