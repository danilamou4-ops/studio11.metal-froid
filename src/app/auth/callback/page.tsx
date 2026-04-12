"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  useEffect(() => {
    const supabase = createClient();

    // Avec implicit flow, Supabase redirige vers :
    //   /auth/callback#access_token=XXX&refresh_token=XXX&type=magiclink
    // getSession() détecte automatiquement le hash et persiste la session.
    supabase.auth.getSession().then(({ data: { session } }) => {
      window.location.href = session ? "/" : "/login?error=true";
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Connexion en cours…</p>
    </div>
  );
}
