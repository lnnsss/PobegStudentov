# Deployment And Assets

## Favicons To Upload

Current placeholder:
- `public/favicon.svg` - scalable favicon, already connected in `index.html`.

Recommended final files to add later:
- `public/favicon.ico` - ICO, include 16x16, 32x32, 48x48.
- `public/favicon-16x16.png` - PNG, 16x16.
- `public/favicon-32x32.png` - PNG, 32x32.
- `public/apple-touch-icon.png` - PNG, 180x180.
- `public/android-chrome-192x192.png` - PNG, 192x192.
- `public/android-chrome-512x512.png` - PNG, 512x512.
- `public/og-image.png` - PNG/JPG, 1200x630 for social previews.

After uploading these, update `index.html` and `public/site.webmanifest` to point to the final PNG/ICO files. Also replace `https://pobeg-studentov.vercel.app` in `index.html`, `robots.txt`, `sitemap.xml`, and `.env.example` with the production domain if it changes.

## Vercel

The project is a static Vite app. Recommended Vercel settings:
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Framework preset: Vite

Environment variables for the next Supabase step:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SITE_URL`

Do not commit real `.env.local` values.

## SEO Checklist

Already configured in `index.html`:
- Russian title and description for the game.
- Open Graph and Twitter preview metadata.
- Search keywords around `Побег студентов`, `Лига студентов`, `Республика Татарстан`, `РТ`, `Татарстан`, `форум`, `студенчество`, `Казань`, `браузерная игра`, and `пиксельный раннер`.
- JSON-LD structured data for `WebSite` and `VideoGame`.
- `robots.txt`, `sitemap.xml`, and canonical URL.

Needed from the owner before final launch:
- Final production domain, if it differs from `https://pobeg-studentov.vercel.app/`.
- Google Search Console verification meta tag value, if using HTML tag verification.
- Yandex Webmaster verification meta tag value, if using HTML tag verification.
- Final 1200x630 social preview image at `public/og-image.png`, if the current logo preview should be replaced.
- Final favicon pack files listed above, if browser/device icons should be fully polished.

After deployment:
- Add the domain in Google Search Console and submit `https://<domain>/sitemap.xml`.
- Add the domain in Yandex Webmaster and submit `https://<domain>/sitemap.xml`.
- If verification uses HTML meta tags, add:
  - `<meta name="google-site-verification" content="..." />`
  - `<meta name="yandex-verification" content="..." />`
  to `index.html`.

## Supabase Plan

For the next step, move records from `localStorage` to Supabase while keeping local fallback.

Suggested table:

```sql
create table public.leaderboard_scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  score integer not null default 0 check (score >= 0),
  stars integer not null default 0 check (stars >= 0),
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leaderboard_scores_score_idx
  on public.leaderboard_scores (score desc, updated_at asc);

alter table public.leaderboard_scores enable row level security;

create policy "Anyone can read leaderboard"
  on public.leaderboard_scores
  for select
  to anon, authenticated
  using (true);
```

For writes we should decide the anti-cheat model before enabling public inserts/updates. The simple version can allow anon upserts by `device_id`; the safer version should write scores through a Vercel serverless function or Supabase Edge Function with validation.
