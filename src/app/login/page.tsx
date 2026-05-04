// Supabase dashboard config required:
// Authentication → Providers → Email:
//   ✅ Enable Email + Password
//   ✅ Enable email confirmations: OFF (manual user creation)

"use client";

import Image from "next/image";
import localFont from "next/font/local";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const gimbalExtended = localFont({
  src: "../fonts/GimbalExtended-Regular.ttf",
  display: "swap",
});

const BRAND_LABEL = "Métal Froid";
const LETTER_INDICES = BRAND_LABEL
  .split("")
  .map((char, index) => (/[a-zA-ZÀ-ÿ]/.test(char) ? index : -1))
  .filter((index) => index >= 0);

function getInitialBrandCasePattern(label: string) {
  return label.split("").map((char) => {
    if (!/[a-zA-ZÀ-ÿ]/.test(char)) return false;
    return (
      char === char.toLocaleUpperCase("fr-FR") &&
      char !== char.toLocaleLowerCase("fr-FR")
    );
  });
}

function mutateBrandCasePattern(pattern: boolean[]) {
  const nextPattern = [...pattern];
  const mutationCount = Math.random() > 0.72 ? 2 : 1;
  const shuffledIndices = [...LETTER_INDICES].sort(() => Math.random() - 0.5);

  for (const index of shuffledIndices.slice(0, mutationCount)) {
    nextPattern[index] = !nextPattern[index];
  }

  return nextPattern;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [brandCasePattern, setBrandCasePattern] = useState(() =>
    getInitialBrandCasePattern(BRAND_LABEL),
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "unauthorized") {
      setError("Accès non autorisé. Contacte l'administrateur.");
    }
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const interval = window.setInterval(() => {
      setBrandCasePattern((currentPattern) =>
        mutateBrandCasePattern(currentPattern),
      );
    }, 900);

    return () => window.clearInterval(interval);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
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

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError("Saisis ton adresse email avant de demander une réinitialisation.");
      return;
    }
    setResetLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo =
      (process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin) + "/auth/callback";

    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setResetLoading(false);
    setResetSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image src="/logo.svg" alt="Métal Froid" width={32} height={32} priority />
          <h1
            aria-label={BRAND_LABEL}
            className={`${gimbalExtended.className} whitespace-nowrap text-xl font-bold tracking-wider text-foreground`}
          >
            {BRAND_LABEL.split("").map((char, index) => {
              const isLetter = /[a-zA-ZÀ-ÿ]/.test(char);
              const isUpper = brandCasePattern[index];
              const displayChar = !isLetter
                ? char
                : isUpper
                  ? char.toLocaleUpperCase("fr-FR")
                  : char.toLocaleLowerCase("fr-FR");

              return (
                <span
                  key={`${char}-${index}`}
                  aria-hidden="true"
                  className={`mf-brand-char ${
                    isLetter
                      ? isUpper
                        ? "mf-brand-char--upper"
                        : "mf-brand-char--lower"
                      : ""
                  }`}
                >
                  {displayChar}
                </span>
              );
            })}
          </h1>
          <p className="text-sm text-muted-foreground">Accès réservé</p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {resetSent && (
          <div className="mb-5 rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm text-emerald-300">
            Un email de réinitialisation a été envoyé.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={resetLoading}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
          >
            {resetLoading ? "Envoi…" : "Mot de passe oublié ?"}
          </button>
        </div>
      </div>
    </div>
  );
}
