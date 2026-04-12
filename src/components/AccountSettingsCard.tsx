"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { useTeamRole } from "@/features/auth/useTeamRole";
import { ViewState } from "@/components/ui/view-state";

type AccountPayload = {
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
};

function initialsFromIdentity(username: string | null, email: string | null) {
  const base = (username?.trim() || email?.split("@")[0] || "MF").trim();
  const words = base.split(/[\s._-]+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }

  return base.slice(0, 2).toUpperCase();
}

export function AccountSettingsCard() {
  const { role, loaded: roleLoaded } = useTeamRole();
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [savingAccount, setSavingAccount] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const initials = useMemo(
    () => initialsFromIdentity(username || null, email),
    [username, email]
  );

  useEffect(() => {
    let active = true;

    async function loadAccountProfile() {
      try {
        const response = await fetch("/api/account/profile", { cache: "no-store" });
        if (!response.ok) {
          if (active) setAccountError("Impossible de charger le profil de compte.");
          return;
        }

        const payload = (await response.json()) as { data: AccountPayload };
        if (!active) return;

        setEmail(payload.data.email);
        setUsername(payload.data.username ?? "");
        setAvatarUrl(payload.data.avatarUrl ?? null);
      } catch {
        if (active) setAccountError("Impossible de charger le profil de compte.");
      } finally {
        if (active) setLoaded(true);
      }
    }

    loadAccountProfile();

    return () => {
      active = false;
    };
  }, []);

  async function handleSaveAccount() {
    try {
      setSavingAccount(true);
      setAccountError(null);
      setAccountMessage(null);

      const response = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim() ? username.trim() : null,
          avatarUrl,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as {
          error?: { message?: string };
        };
        throw new Error(payload.error?.message || "Impossible de sauvegarder le compte.");
      }

      setAccountMessage("Profil de compte sauvegarde.");
    } catch (error) {
      setAccountError(
        error instanceof Error ? error.message : "Impossible de sauvegarder le compte."
      );
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) {
      setPasswordError("Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      setSavingPassword(true);
      setPasswordError(null);
      setPasswordMessage(null);

      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        throw error;
      }

      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Mot de passe mis a jour.");
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : "Impossible de changer le mot de passe."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  if (!loaded) {
    return (
      <ViewState
        variant="loading"
        title="Chargement du compte"
        description="Récupération des informations de profil en cours..."
      />
    );
  }

  return (
    <div className="space-y-5 rounded-[var(--radius)] border border-border bg-card p-5 md:p-6 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-foreground">Profil de compte</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Gere ton identite utilisateur et ton mot de passe.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-secondary bg-cover bg-center text-sm font-semibold text-foreground"
          style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
          aria-label="Avatar"
        >
          {!avatarUrl && initials}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {username.trim() || "Username non defini"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{email || "Email inconnu"}</p>
          {roleLoaded && role ? (
            <p className="mt-1 inline-flex rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {role}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ex: oggikeens"
          className="w-full rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">3 a 32 caracteres: lettres, chiffres, _ ou -.</p>
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleSaveAccount}
          disabled={savingAccount}
          className="rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {savingAccount ? "Sauvegarde..." : "Sauvegarder le compte"}
        </button>
      </div>

      {accountMessage ? (
        <ViewState
          variant="success"
          title="Compte mis à jour"
          description={accountMessage}
        />
      ) : null}
      {accountError ? (
        <ViewState
          variant="error"
          title="Mise à jour impossible"
          description={accountError}
        />
      ) : null}

      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">Changer le mot de passe</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="new-password" className="block text-xs font-medium text-muted-foreground">
              Nouveau mot de passe
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nouveau mot de passe"
              className="w-full rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="confirm-password" className="block text-xs font-medium text-muted-foreground">
              Confirmer le mot de passe
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmer le mot de passe"
              className="w-full rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={savingPassword}
            className="rounded-[var(--radius)] border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
          >
            {savingPassword ? "Mise a jour..." : "Mettre a jour le mot de passe"}
          </button>
        </div>
        {passwordMessage ? (
          <ViewState
            variant="success"
            className="mt-3"
            title="Mot de passe mis à jour"
            description={passwordMessage}
          />
        ) : null}
        {passwordError ? (
          <ViewState
            variant="error"
            className="mt-3"
            title="Changement de mot de passe impossible"
            description={passwordError}
          />
        ) : null}
      </div>
    </div>
  );
}
