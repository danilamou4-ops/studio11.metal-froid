import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser, getUserTeamRole } from "@/lib/auth/route-auth";

const createTicketSchema = z.object({
  playlist_id: z.string().uuid(),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000),
  evidence_snapshot: z.record(z.any()).optional(),
});

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
    const supabase = createAdminClient();

    let query = supabase
      .from("quality_tickets")
      .select("id,playlist_id,status,priority,title,description,reported_by,assigned_to,escalated_to,escalated_at,resolution_note,resolved_at,closed_at,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (role !== "admin") {
      query = query.eq("reported_by", user.id);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: { code: "QUALITY_TICKETS_FETCH_FAILED", message: error.message } },
        { status: 500 },
      );
    }

    return NextResponse.json({ tickets: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "QUALITY_TICKETS_FETCH_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createTicketSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "Invalid payload",
          },
        },
        { status: 400 },
      );
    }

    const { user } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 },
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("quality_tickets")
      .insert({
        playlist_id: parsed.data.playlist_id,
        title: parsed.data.category || "Quality issue",
        description: parsed.data.description || null,
        priority: "normal",
        reported_by: user.id,
        evidence_snapshot: parsed.data.evidence_snapshot || null,
      })
      .select("id,playlist_id,status,priority,title,description,reported_by,created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: { code: "QUALITY_TICKET_CREATE_FAILED", message: error.message } },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "QUALITY_TICKET_CREATE_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 },
    );
  }
}
