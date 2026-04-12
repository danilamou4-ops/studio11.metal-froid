-- ============================================================
-- CURATOR MATCH — Migration 001 : schema core MVP
-- ============================================================

create extension if not exists "uuid-ossp";

create table if not exists curators (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  platform      text not null default 'spotify',
  country       text,
  contact_url   text unique,
  instagram_url text,
  email         text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists playlists (
  id                        uuid primary key default uuid_generate_v4(),
  curator_id                uuid references curators(id) on delete set null,
  spotify_playlist_id       text unique not null,
  name                      text not null,
  spotify_url               text not null,
  followers                 integer,
  description               text,
  genre_label               text,
  genres_normalized         jsonb default '[]',
  avg_bpm                   numeric(6,2),
  avg_energy                numeric(4,3),
  avg_danceability          numeric(4,3),
  avg_valence               numeric(4,3),
  avg_acousticness          numeric(4,3),
  avg_speechiness           numeric(4,3),
  track_count_analyzed      integer,
  audio_profile_version     integer default 0,
  last_enriched_at          timestamptz,
  accepts_submissions       boolean default true,
  is_active                 boolean default true,
  profile_completeness      numeric(4,3) default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table if not exists search_runs (
  id               uuid primary key default uuid_generate_v4(),
  user_id          text,
  source           text not null,
  track_name       text,
  artist_name      text,
  spotify_track_id text,
  bpm              numeric(6,2),
  energy           numeric(4,3),
  danceability     numeric(4,3),
  valence          numeric(4,3),
  acousticness     numeric(4,3),
  speechiness      numeric(4,3),
  genre_input      text,
  result_count     integer,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists search_results (
  id            uuid primary key default uuid_generate_v4(),
  search_run_id uuid not null references search_runs(id) on delete cascade,
  playlist_id   uuid not null references playlists(id) on delete cascade,
  rank          integer not null,
  score         numeric(5,2) not null,
  score_details jsonb default '{}',
  created_at    timestamptz not null default now()
);

create table if not exists click_events (
  id            uuid primary key default uuid_generate_v4(),
  search_run_id uuid references search_runs(id) on delete set null,
  playlist_id   uuid references playlists(id) on delete set null,
  user_id       text,
  clicked_url   text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_playlists_spotify_id on playlists(spotify_playlist_id);
create index if not exists idx_playlists_curator_id on playlists(curator_id);
create index if not exists idx_playlists_active on playlists(is_active) where is_active = true;
create index if not exists idx_playlists_enriched on playlists(last_enriched_at) where last_enriched_at is not null;
create index if not exists idx_playlists_followers on playlists(followers desc);
create index if not exists idx_search_results_run on search_results(search_run_id);
create index if not exists idx_search_results_playlist on search_results(playlist_id);
create index if not exists idx_click_events_run on click_events(search_run_id);
create index if not exists idx_click_events_playlist on click_events(playlist_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_curators_updated_at
  before update on curators
  for each row execute function set_updated_at();

create trigger trg_playlists_updated_at
  before update on playlists
  for each row execute function set_updated_at();
