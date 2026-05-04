"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Handles OAuth code exchange (e.g. password reset redirect from Supabase).
// Magic link flow has been removed — only email+password auth is supported.
export default function AuthCallbackPage() {
  useEffect(() => {
    const supabase = createClient();
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
