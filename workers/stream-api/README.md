# CarBuy Stream API (Cloudflare Worker)

Creates Cloudflare Stream **direct creator uploads** and applies webhook/status updates to Supabase listings.

## Setup

1. Create a Cloudflare API token with **Stream:Edit**.
2. Copy secrets:

```bash
cd workers/stream-api
cp .dev.vars.example .dev.vars
npm install
```

Fill `.dev.vars`:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_API_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STREAM_WEBHOOK_SECRET` (from Stream webhook subscribe response; can set after first deploy)

3. Run locally:

```bash
npm run dev
```

4. Frontend `.env`:

```
VITE_STREAM_API_URL=http://127.0.0.1:8787
```

5. Deploy:

```bash
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
npx wrangler secret put CLOUDFLARE_STREAM_API_TOKEN
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put STREAM_WEBHOOK_SECRET
npm run deploy
```

6. Register Stream webhook to `https://<worker>/webhook` (Dashboard or API). Save the returned `secret` as `STREAM_WEBHOOK_SECRET`.

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/create-upload` | Supabase Bearer JWT | `{ listingId, kind }` → `{ uploadURL, uid }` |
| GET | `/status/:uid` | Supabase Bearer JWT | Poll encode status; patches listing when ready |
| POST | `/webhook` | Stream signature | Marks listing ready/failed |
| GET | `/health` | — | Liveness |

Direct upload uses Stream **basic POST** (files ≤ 200 MB). Client uploads with `FormData` + XHR progress.
