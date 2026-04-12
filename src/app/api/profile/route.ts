import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const profileSchema = z.object({
  genres: z.array(z.string()),
  influences: z.string(),
  langue: z.enum(["fr", "en", "fr+en"]),
  bpmMin: z.number().nullable(),
  bpmMax: z.number().nullable(),
  energy: z.enum(["faible", "moyen", "élevé"]).nullable(),
  ambiance: z.string(),
  marchePrioritaire: z.string(),
  niveauMainstream: z.enum(["underground", "indépendant", "mainstream"]),
});

function createRouteClient() {
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

export async function GET() {
  try {
    const supabase = createRouteClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required.",
          },
        },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("artist_profiles")
      .select("profile")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error: {
            code: "PROFILE_FETCH_FAILED",
            message: error.message,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data?.profile ?? null });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "PROFILE_FETCH_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const json = await request.json();
    const parsed = profileSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "Invalid payload",
          },
        },
        { status: 400 }
      );
    }

    const supabase = createRouteClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required.",
          },
        },
        { status: 401 }
      );
    }

    const { error } = await supabase.from("artist_profiles").upsert(
      {
        user_id: user.id,
        profile: parsed.data,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      return NextResponse.json(
        {
          error: {
            code: "PROFILE_SAVE_FAILED",
            message: error.message,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "PROFILE_SAVE_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    );
  }
}
