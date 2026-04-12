import { Link2 } from "lucide-react";
import React from "react";

export type PlatformConfig = { label: string; color: string; icon: React.ReactNode };

export const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  spotify: {
    label: "Spotify",
    color: "#1DB954",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.623.623 0 0 1-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 1 1-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 0 1 .207.857zm1.223-2.72a.78.78 0 0 1-1.072.257c-2.687-1.652-6.786-2.13-9.965-1.166a.78.78 0 0 1-.973-.519.78.78 0 0 1 .519-.972c3.632-1.102 8.147-.568 11.234 1.328a.78.78 0 0 1 .257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.935.935 0 1 1-.543-1.79c3.532-1.072 9.404-.865 13.115 1.338a.934.934 0 0 1-.954 1.61z" />
      </svg>
    ),
  },
  deezer: {
    label: "Deezer",
    color: "#A259FF",
    icon: (
      <svg viewBox="0 0 120.65 120.65" fill="currentColor" className="h-3 w-3">
        <path d="M101.19 18.41c1.12-6.47 2.75-10.54 4.57-10.55 3.38.01 6.13 14.12 6.13 31.54s-2.75 31.54-6.13 31.54c-1.39 0-2.67-2.4-3.7-6.42-1.63 14.71-5.01 24.82-8.93 24.82-3.03 0-5.75-6.07-7.58-15.65-1.25 18.22-4.38 31.14-8.05 31.14-2.3 0-4.4-5.12-5.95-13.46-1.87 17.21-6.18 29.28-11.22 29.28s-9.36-12.06-11.22-29.28c-1.54 8.34-3.64 13.46-5.95 13.46-3.67 0-6.8-12.93-8.05-31.14-1.83 9.58-4.54 15.65-7.58 15.65-3.91 0-7.3-10.11-8.93-24.82-1.02 4.03-2.31 6.42-3.7 6.42-3.39 0-6.13-14.12-6.13-31.54S11.51 7.86 14.9 7.86c1.82 0 3.44 4.08 4.57 10.55C21.28 7.25 24.21 0 27.53 0c3.94 0 7.35 10.26 8.97 25.15C38.08 14.31 40.48 7.4 43.16 7.4c3.76 0 6.96 13.59 8.15 32.55 2.23-9.72 5.46-15.82 9.03-15.82s6.8 6.1 9.02 15.82C70.55 20.99 73.74 7.4 77.51 7.4c2.68 0 5.07 6.91 6.66 17.75C85.78 10.26 89.2 0 93.13 0c3.31 0 6.25 7.26 8.06 18.41zM0 36.3c0-7.79 1.56-14.1 3.48-14.1s3.48 6.31 3.48 14.1S5.4 50.4 3.48 50.4 0 44.08 0 36.3zm113.7 0c0-7.79 1.56-14.1 3.48-14.1s3.48 6.31 3.48 14.1-1.56 14.1-3.48 14.1-3.48-6.32-3.48-14.1z" />
      </svg>
    ),
  },
  apple_music: {
    label: "Apple Music",
    color: "#FC3C44",
    icon: (
      <svg viewBox="0 0 120 120" fill="currentColor" className="h-3 w-3">
        <path d="M88 72.5V76a38 38 0 0 1-.6 6.7 8.53 8.53 0 0 1-3.6 5.6h-.1a12.36 12.36 0 0 1-6.9 2.5l-1.9.2a9.54 9.54 0 0 1-7.9-3.4 8.78 8.78 0 0 1-1.4-8.8v-.1a9.25 9.25 0 0 1 6.5-5.8l7.5-2a4.296 4.296 0 0 0 3.3-4.2V40.1a1.61 1.61 0 0 0-.6-1.3 1.74 1.74 0 0 0-1.4-.3l-32 6.5a2.376 2.376 0 0 0-2 2.4v36.7a38 38 0 0 1-.6 6.7 8.53 8.53 0 0 1-3.6 5.6h-.1a12.36 12.36 0 0 1-6.9 2.5l-1.8.1a9.54 9.54 0 0 1-7.9-3.4 8.78 8.78 0 0 1-1.4-8.8v-.1a9.25 9.25 0 0 1 6.5-5.8l7.5-2a4.296 4.296 0 0 0 3.3-4.2V29.9a3.72 3.72 0 0 1 3-3.6L85 19a3.14 3.14 0 0 1 2.1.5 2.46 2.46 0 0 1 .9 1.9z" />
      </svg>
    ),
  },
  napster: {
    label: "Napster",
    color: "#406EAF",
    icon: (
      <svg viewBox="0 0 500 498" fill="currentColor" className="h-3 w-3">
        <path d="M252.914 44.937c-44.326-.298-87.85 17.155-120.468 48.89l-11.307 11.001-12.68-2.502c-6.971-1.371-16.529-2.855-21.24-3.296l-8.56-.793v30.533l-6.729 5.127c-19.179 14.626-31.426 42.826-29.877 68.756 1.456 24.361 14.936 49.508 33.524 62.515 2.48 1.735 3.537 4.7 5.31 15.045 12.755 74.431 70.26 131.965 144.425 144.486 15.463 2.61 45.86 1.655 61.66-1.938 70.306-15.988 122.78-71.402 135.071-142.639 1.776-10.291 2.842-13.376 5.188-14.923 6.503-4.289 19.661-19.276 23.896-27.222 12.01-22.537 13.018-51.301 2.609-74.57-4.626-10.342-14.709-23.456-22.736-29.572l-6.82-5.188-.078-30.441-.078-30.441-9.247.839c-5.088.463-14.498 1.908-20.905 3.204l-11.642 2.35-11.106-10.685c-27.24-26.165-61.922-42.804-98.599-47.302a160.778 160.778 0 0 0-19.028-1.22z" />
      </svg>
    ),
  },
  youtube_music: {
    label: "YouTube",
    color: "#FF0000",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
        <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
      </svg>
    ),
  },
  soundcloud: {
    label: "SoundCloud",
    color: "#FF5500",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
        <path d="M1.175 12.225c-.015 0-.03.01-.03.025l-.435 2.26.435 2.233c0 .015.015.025.03.025.015 0 .025-.01.03-.025l.5-2.23-.5-2.26c-.005-.015-.015-.028-.03-.028zm1.65-.7c-.02 0-.035.012-.038.03L2.35 14.51l.437 2.17c.003.018.018.03.038.03.018 0 .033-.012.037-.03l.5-2.17-.5-2.956c-.004-.018-.02-.03-.037-.03zm1.652-.23c-.02 0-.038.015-.04.034l-.41 3.18.41 2.1c.003.02.02.034.04.034.02 0 .038-.015.04-.034l.467-2.1-.467-3.18c-.002-.02-.02-.035-.04-.035zm6.75-4.33c-.11 0-.2.09-.2.2v10.1c0 .11.09.2.2.2h13.39c.11 0 .2-.09.2-.2V7.365c0-.11-.09-.2-.2-.2H11.227z" />
      </svg>
    ),
  },
};

const PLATFORM_DEFAULT: PlatformConfig = {
  label: "Autre",
  color: "#6B7280",
  icon: <Link2 className="h-3 w-3" />,
};

export function getPlatformConfig(platform: string): PlatformConfig {
  return PLATFORM_CONFIG[platform] ?? { ...PLATFORM_DEFAULT, label: platform };
}

export function resolvePlatformUrl(
  platform: string,
  platforms: string[],
  platformUrls: string[],
  fallbackUrl: string,
): string | null {
  const normalized = platform.toLowerCase();
  const byDomain = platformUrls.find((url) => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (normalized === "apple_music") return host.includes("apple");
      if (normalized === "youtube_music") return host.includes("youtube");
      return host.includes(normalized.replace("_", "")) || host.includes(normalized.split("_")[0]);
    } catch {
      return false;
    }
  });
  return byDomain ?? platformUrls[0] ?? fallbackUrl ?? null;
}

type PlatformBadgesProps = {
  platforms: string[];
  platformUrls: string[];
  fallbackUrl: string;
  playlistId: string;
  onTrackClick?: (playlistId: string, url: string) => void;
  maxVisible?: number;
};

export function PlatformBadges({
  platforms,
  platformUrls,
  fallbackUrl,
  playlistId,
  onTrackClick,
  maxVisible,
}: PlatformBadgesProps) {
  if (!platforms.length) return null;

  const visiblePlatforms = typeof maxVisible === "number" ? platforms.slice(0, maxVisible) : platforms;
  const hiddenCount = typeof maxVisible === "number" ? Math.max(0, platforms.length - visiblePlatforms.length) : 0;

  return (
    <>
      {visiblePlatforms.map((platform) => {
        const url = resolvePlatformUrl(platform, platforms, platformUrls, fallbackUrl);
        const cfg = getPlatformConfig(platform);
        if (!url) return null;
        return (
          <a
            key={`${playlistId}-${platform}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Écouter sur ${cfg.label}`}
            onClick={() => onTrackClick?.(playlistId, url)}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-75"
            style={{
              borderColor: cfg.color + "55",
              backgroundColor: cfg.color + "18",
              color: cfg.color,
            }}
          >
            <span style={{ color: cfg.color }}>{cfg.icon}</span>
            <span>{cfg.label}</span>
          </a>
        );
      })}
      {hiddenCount > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
          +{hiddenCount}
        </span>
      ) : null}
    </>
  );
}
