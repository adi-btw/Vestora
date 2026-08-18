# Backend (Supabase)

Postgres schema, row-level security policies, and the Edge Functions that act as
the app's API layer. Every third-party key lives here as a function secret, never
in the client bundle.

## Layout

```
migrations/   Ordered SQL migrations - schema, RLS policies, triggers
functions/
  _shared/    Provider clients, caching, rate limiting, scoring, push delivery
  market-data/       Quotes, bars, sparklines, search, company snapshots
  summarize-news/    News feed plus one cached AI sentiment summary per symbol/day
  ai-chat/           Gemini tool-calling advisor over the market-data tools
  recommend/         Deterministic candidate scoring plus AI explanations
  register-push-token/  Stores an Expo push token for the signed-in user
  scan-alerts/       Cron-driven alert evaluation and push delivery
```

## First-time setup

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push          # apply migrations
npm run secrets:set      # upload function secrets
npm run functions:deploy # deploy every function
```

`npm run secrets:set` reads `supabase/functions/.env.local`, which is git-ignored.
Create it from the server-side section of `.env.example`:

```
FINNHUB_API_KEY=...
ALPACA_API_KEY_ID=...
ALPACA_API_SECRET_KEY=...
GEMINI_API_KEY=...
CRON_SECRET=...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected
into functions automatically - do not set them yourself.

## Local development

```bash
npx supabase start                 # local Postgres, Auth, Studio
npm run db:reset                   # re-run every migration from scratch
npm run functions:serve            # serve functions against the local stack
```

## Scheduled work

`scan-alerts` is triggered by `.github/workflows/scan-alerts.yml` rather than
Supabase's cron extension, which is not on the free plan. It authenticates with
the `x-cron-secret` header, so the repository needs two secrets:

| Secret         | Value                                          |
| -------------- | ---------------------------------------------- |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co`            |
| `CRON_SECRET`  | The same value set as a function secret above  |

The schedule doubles as a keep-alive: free Supabase projects pause after a week
of inactivity, and a periodic query prevents that.

## Conventions

- **RLS everywhere.** User-owned tables are readable only by their owner. Shared
  caches (`quote_cache`, `bar_cache`, `news_cache`, `company_cache`,
  `rate_limits`) have RLS enabled with no policies, so only the service role can
  touch them.
- **Read-through caching.** Functions serve from Postgres first and only call a
  provider when a row is missing or older than its TTL, which is what keeps the
  app inside free-tier quotas.
- **Uniform errors.** Functions return `{ error: { code, message } }`; the client
  maps that onto `ApiError` so screens can branch on `isRateLimited` or
  `isQuotaExhausted`.
