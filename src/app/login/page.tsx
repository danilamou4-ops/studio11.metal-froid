"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "password" | "magic-link";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "unauthorized") {
      setError("Accès non autorisé. Contacte l'administrateur.");
    }
  }, []);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);
    if (authError) {
      setError("Email ou mot de passe incorrect.");
    } else {
      window.location.href = "/";
    }
  }

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo =
      (process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin) + "/auth/callback";

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });

    setLoading(false);
    if (otpError) {
      setError("Impossible d'envoyer le lien. Vérifie l'adresse email.");
    } else {
      setMagicLinkSent(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image src="/logo.svg" alt="Métal Froid" width={32} height={32} priority />
          <h1 className="font-sans text-xl font-bold tracking-wider text-foreground">
            MÉTAL FROID
          </h1>
          <p className="text-sm text-muted-foreground">Accès réservé</p>
        </div>

        {/* Sélecteur de mode */}
        <div className="mb-6 flex rounded-lg border border-border bg-secondary p-0.5">
          <button
            type="button"
            onClick={() => { setMode("password"); setError(null); setMagicLinkSent(false); }}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              mode === "password"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Mot de passe
          </button>
          <button
            type="button"
            onClick={() => { setMode("magic-link"); setError(null); setMagicLinkSent(false); }}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              mode === "magic-link"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Lien magique
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {magicLinkSent ? (
          <div className="rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-4 text-sm text-emerald-300">
            <p className="font-medium mb-1">Lien envoyé !</p>
            <p className="text-emerald-400">Vérifie ta boîte mail ({email}) et clique sur le lien pour te connecter.</p>
          </div>
        ) : mode === "password" ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.com"
                required
                autoComplete="email"
                className="w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[var(--radius)] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email-otp" className="text-sm font-medium text-foreground">
                Adresse e-mail
              </label>
              <input
                id="email-otp"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.com"
                required
                autoComplete="email"
                className="w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[var(--radius)] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Envoi en cours…" : "Envoyer le lien magique"}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Un lien de connexion sera envoyé à ton adresse email.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
