"use client";

import { useState } from "react";

import { AddPlaylistFormView } from "./AddPlaylistFormView";
import { AllPlaylistsView } from "@/components/AllPlaylistsView";
import { ArtistProfileForm } from "@/components/ArtistProfileForm";
import { TrackFeatureTester } from "@/components/TrackFeatureTester";

type TabKey = "matching" | "all-playlists" | "add-playlist" | "profil";

export function HomeTabs() {
  const [tab, setTab] = useState<TabKey>("matching");
  const [playlistsRefreshKey, setPlaylistsRefreshKey] = useState(0);

  function handlePlaylistAdded() {
    setPlaylistsRefreshKey((k) => k + 1);
    setTab("all-playlists");
  }

  return (
    <div className="space-y-4">
      <nav className="border-b border-border">
        <ul className="flex gap-0">
          <li>
            <button
              type="button"
              onClick={() => setTab("matching")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === "matching"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Matching
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setTab("all-playlists")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === "all-playlists"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Toutes les playlists
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setTab("add-playlist")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === "add-playlist"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ajouter une playlist
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setTab("profil")}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === "profil"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mon profil
            </button>
          </li>
        </ul>
      </nav>

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
    </div>
  );
}
