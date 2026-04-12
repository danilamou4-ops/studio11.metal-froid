import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const accountProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Le username doit contenir au moins 3 caracteres.")
    .max(32, "Le username ne doit pas depasser 32 caracteres.")
    .regex(/^[a-zA-Z0-9_-]+$/, "Utilise uniquement lettres, chiffres, _ ou -.")
    .nullable(),
  avatarUrl: z.string().url().nullable(),
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
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("user_account_profiles")
      .select("username, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error: {
            code: "ACCOUNT_PROFILE_FETCH_FAILED",
            message: error.message,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        email: user.email ?? null,
        username: data?.username ?? null,
        avatarUrl: data?.avatar_url ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "ACCOUNT_PROFILE_FETCH_FAILED",
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
    const parsed = accountProfileSchema.safeParse(json);

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
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 }
      );
    }

    const username = parsed.data.username ? parsed.data.username.trim() : null;

    const { error } = await supabase.from("user_account_profiles").upsert(
      {
        user_id: user.id,
        username,
        avatar_url: parsed.data.avatarUrl,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      const isConflict = error.code === "23505";
      return NextResponse.json(
        {
          error: {
            code: isConflict ? "USERNAME_TAKEN" : "ACCOUNT_PROFILE_SAVE_FAILED",
            message: isConflict
              ? "Ce username est deja utilise."
              : error.message,
          },
        },
        { status: isConflict ? 409 : 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "ACCOUNT_PROFILE_SAVE_FAILED",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    );
  }
}
