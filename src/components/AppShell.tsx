"use client";

import Image from "next/image";
import localFont from "next/font/local";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useTeamRole } from "@/features/auth/useTeamRole";
import { createClient } from "@/lib/supabase/client";
import { AddPlaylistFormView } from "@/components/AddPlaylistFormView";
import { AllPlaylistsView } from "@/components/AllPlaylistsView";
import { ArtistProfileForm } from "@/components/ArtistProfileForm";
import { TrackFeatureTester } from "@/components/TrackFeatureTester";

type TabKey = "matching" | "all-playlists" | "add-playlist" | "profil";

const NAV_ITEMS: { key: TabKey; label: string }[] = [
  { key: "matching", label: "Matching" },
  { key: "all-playlists", label: "Toutes les playlists" },
  { key: "add-playlist", label: "Ajouter une playlist" },
  { key: "profil", label: "Mon profil" },
];

const gimbalExtended = localFont({
  src: "../app/fonts/GimbalExtended-Regular.ttf",
  display: "swap",
});

const BRAND_LABEL = "Métal Froid";
const BRAND_LETTER_INDICES = BRAND_LABEL
  .split("")
  .map((char, index) => (/[a-zA-ZÀ-ÿ]/.test(char) ? index : -1))
  .filter((index) => index >= 0);

function getInitialBrandCasePattern(label: string) {
  return label.split("").map((char) => {
    if (!/[a-zA-ZÀ-ÿ]/.test(char)) return false;
    return char === char.toLocaleUpperCase("fr-FR") && char !== char.toLocaleLowerCase("fr-FR");
  });
}

function mutateBrandCasePattern(pattern: boolean[]) {
  const nextPattern = [...pattern];
  const mutationCount = Math.random() > 0.72 ? 2 : 1;
  const shuffledIndices = [...BRAND_LETTER_INDICES].sort(() => Math.random() - 0.5);

  for (const index of shuffledIndices.slice(0, mutationCount)) {
    nextPattern[index] = !nextPattern[index];
  }

  return nextPattern;
}

export function AppShell() {
  const { isAdmin, loaded: roleLoaded } = useTeamRole();
  const [tab, setTab] = useState<TabKey>("matching");
  const [playlistsRefreshKey, setPlaylistsRefreshKey] = useState(0);
  const [hasSession, setHasSession] = useState(false);
  const [brandCasePattern, setBrandCasePattern] = useState(() => getInitialBrandCasePattern(BRAND_LABEL));
  const [contributionsSuspended, setContributionsSuspended] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const interval = window.setInterval(() => {
      setBrandCasePattern((currentPattern) => mutateBrandCasePattern(currentPattern));
    }, 900);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!roleLoaded || !isAdmin) {
      setContributionsSuspended(false);
      return;
    }

    let active = true;

    async function loadGovernanceControl() {
      try {
        const response = await fetch('/api/governance/controls', { cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { data?: { contributions_suspended?: boolean } };
        if (active) {
          setContributionsSuspended(Boolean(payload.data?.contributions_suspended));
        }
      } catch {
        // Ignore transient governance fetch failures in header badge.
      }
    }

    void loadGovernanceControl();
    const interval = window.setInterval(() => {
      void loadGovernanceControl();
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [isAdmin, roleLoaded]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function handleTabChange(next: TabKey) {
    setTab(next);
  }

  function handlePlaylistAdded() {
    setPlaylistsRefreshKey((k) => k + 1);
    setTab("all-playlists");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">

      {/* ── Sticky top chrome ───────────────────────────────────── */}
      <div className="sticky top-0 z-30 w-full">

        {/* ZONE 1 — Brand header bar (72px) */}
        <div className="border-b border-border bg-background">
          <div className="flex h-[88px] items-center px-6 md:px-12">
            {/* Left: logo + title on first line, subtitle on second line (fixed position) */}
            <div className="min-w-0 flex flex-1 items-center gap-3">
              <Image
                src="/logo.svg"
                alt="Métal Froid"
                width={60}
                height={60}
                priority
                className="h-9 w-9 shrink-0"
              />
              <div className="min-w-0">
                <span
                  aria-label={BRAND_LABEL}
                  className={`${gimbalExtended.className} block shrink-0 text-lg font-bold tracking-wider leading-none text-foreground`}
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
                        className={`mf-brand-char ${isLetter ? (isUpper ? "mf-brand-char--upper" : "mf-brand-char--lower") : ""}`}
                      >
                        {displayChar}
                      </span>
                    );
                  })}
                </span>
                <p className="hidden truncate text-sm text-muted-foreground md:block">
                  Analyse ton morceau localement et trouve les playlists curatées les plus compatibles.
                </p>
              </div>
            </div>
            {/* Right: logout + toggle + version */}
            <div className="ml-4 flex shrink-0 items-center gap-3">
              {isAdmin && contributionsSuspended ? (
                <span className="rounded-full border border-destructive/40 bg-destructive/10 text-destructive">
                  Contributions suspendues
                </span>
              ) : null}
              {hasSession && (
                <button
                  onClick={handleLogout}
                  aria-label="Se déconnecter"
                  title="Se déconnecter"
                  className="rounded-[var(--radius)] border border-border p-2 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  <LogOut size={16} />
                </button>
              )}
              <ThemeToggle />
              <span className="hidden text-xs text-muted-foreground md:inline">v0.6</span>
            </div>
          </div>
        </div>

        {/* ZONE 2 — Nav tabs bar (44px) */}
        <div className="border-b border-border bg-background">
          <nav className="overflow-x-auto">
            <ul className="flex h-11 items-end justify-center gap-0">
              {NAV_ITEMS.map(({ key, label }) => (
                <li key={key} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTabChange(key)}
                    className={`whitespace-nowrap px-4 pb-2.5 pt-2 text-sm font-medium transition-colors ${
                      tab === key
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

      </div>

      {/* ── ZONE 3 — Page content ───────────────────────────────── */}
      <main id="main-content" className="mx-auto w-full max-w-4xl flex-1 px-4 pt-8 pb-10 md:pt-10 md:pb-14">
        <div className={tab === "matching" ? "block" : "hidden"}>
          <TrackFeatureTester />
        </div>
        <div className={tab === "all-playlists" ? "block" : "hidden"}>
          <AllPlaylistsView refreshKey={playlistsRefreshKey} />
        </div>
        <div className={tab === "add-playlist" ? "block" : "hidden"}>
          <AddPlaylistFormView onAdded={handlePlaylistAdded} />
        </div>
        <div className={tab === "profil" ? "block" : "hidden"}>
          <ArtistProfileForm />
        </div>
      </main>
    </div>
  );
}
