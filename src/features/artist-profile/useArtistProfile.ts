"use client";

import { useCallback, useEffect, useState } from "react";

import { EMPTY_PROFILE, type ArtistProfile } from "./types";

export function useArtistProfile() {
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        if (!response.ok) {
          if (active) setProfile(null);
          return;
        }

        const payload = (await response.json()) as { data: ArtistProfile | null };
        if (active) setProfile(payload.data);
      } catch {
        if (active) setProfile(null);
      } finally {
        if (active) setLoaded(true);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const saveProfile = useCallback(async (data: ArtistProfile) => {
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("PROFILE_SAVE_FAILED");
    }

    setProfile(data);
  }, []);

  const clearProfile = useCallback(async () => {
    await saveProfile(EMPTY_PROFILE);
    setProfile(EMPTY_PROFILE);
  }, [saveProfile]);

  return { profile, loaded, saveProfile, clearProfile, EMPTY_PROFILE };
}
