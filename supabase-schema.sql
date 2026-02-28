-- ═══════════════════════════════════════════════════════════════
--  The Still — Full Database Schema
--  Run in your Supabase SQL editor
-- ═══════════════════════════════════════════════════════════════

-- ── Ratings ──────────────────────────────────────────────────────
create table if not exists public.ratings (
  id          uuid primary key default gen_random_uuid(),
  bottle_id   text        not null,
  rating      integer     not null check (rating between 1 and 10),
  nose        text,
  palate      text,
  finish      text,
  session_id  text        not null,
  created_at  timestamptz not null default now(),

  unique (bottle_id, session_id)
);

alter table public.ratings enable row level security;

create policy "Ratings are public"
  on public.ratings for select using (true);

create policy "Anyone can submit a rating"
  on public.ratings for insert with check (true);

create policy "Users can update own rating"
  on public.ratings for update using (true);


-- ── Community Submissions ─────────────────────────────────────────
create table if not exists public.submissions (
  id           uuid primary key default gen_random_uuid(),

  -- What kind of entity is being submitted
  type         text not null check (type in ('brand', 'sub_brand', 'bottle')),

  -- Full entity payload as JSON
  data         jsonb not null,

  -- Reference to parent entity (brand_id for sub_brand, sub_brand_id for bottle)
  parent_id    text,
  parent_name  text,  -- human-readable label shown to admin

  -- Who submitted it
  session_id   text not null,

  -- Moderation
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected')),
  admin_note   text,
  submitted_at timestamptz not null default now(),
  reviewed_at  timestamptz
);

alter table public.submissions enable row level security;

-- Public: anyone can submit
create policy "Anyone can submit"
  on public.submissions for insert
  with check (true);

-- Public: approved submissions are readable by everyone
-- (so the treemap can load community data without auth)
create policy "Approved submissions are public"
  on public.submissions for select
  using (status = 'approved');

-- Admin: service role key bypasses RLS so no extra policy needed for admin reads/updates
-- If you want to use the anon key for admin (not recommended), add:
-- create policy "Admin reads all" on public.submissions for select using (auth.role() = 'authenticated');
-- create policy "Admin updates" on public.submissions for update using (auth.role() = 'authenticated');


-- ── Supabase Auth — Site URL config ──────────────────────────────
-- In your Supabase dashboard → Authentication → URL Configuration:
--   Site URL:        http://localhost:3000 (or your prod URL)
--   Redirect URLs:   http://localhost:3000/admin/callback
