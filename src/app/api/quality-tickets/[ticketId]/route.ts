import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser, getUserTeamRole } from "@/lib/auth/route-auth";

const updateTicketSchema = z.object({
  status: z.enum(["open", "in_review", "escalated", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  escalatedTo: z.string().uuid().nullable().optional(),
  resolutionNote: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { ticketId: string } },
) {
  try {
    const body = await request.json();
    const parsed = updateTicketSchema.safeParse(body);

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

    const role = await getUserTeamRole(user.id, user.email ?? null);

    if (role !== "admin") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Admin role required." } },
        { status: 403 },
      );
    }

    const now = new Date().toISOString();
    const payload: Record<string, string | null> = {};

    if (parsed.data.status) {
      payload.status = parsed.data.status;
      if (parsed.data.status === "escalated") payload.escalated_at = now;
      if (parsed.data.status === "resolved") payload.resolved_at = now;
      if (parsed.data.status === "closed") payload.closed_at = now;
    }

    if (parsed.data.priority) payload.priority = parsed.data.priority;
    if (parsed.data.assignedTo !== undefined) payload.assigned_to = parsed.data.assignedTo;
    if (parsed.data.escalatedTo !== undefined) payload.escalated_to = parsed.data.escalatedTo;
    if (parsed.data.resolutionNote !== undefined) payload.resolution_note = parsed.data.resolutionNote;

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "No fields to update." } },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("quality_tickets")
      .update(payload)
      .eq("id", params.ticketId)
      .select("id,playlist_id,status,priority,title,description,reported_by,assigned_to,escalated_to,escalated_at,resolution_note,resolved_at,closed_at,created_at,updated_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: { code: "QUALITY_TICKET_UPDATE_FAILED", message: error.message } },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "QUALITY_TICKET_UPDATE_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 },
    );
  }
}
