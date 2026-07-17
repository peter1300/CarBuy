# CarBuy

Videós használtautó piactér (Vite + React + Supabase).

## Beállítás

1. Hozz létre projektet a [Supabase](https://supabase.com)-on.
2. SQL Editorben futtasd: [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql)
3. Másold a Project Settings → API értékeket a `.env` fájlba:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

4. Auth → Providers → Email: érdemes kikapcsolni a „Confirm email” opciót fejlesztéshez, különben a regisztráció után e-mail megerősítés kell.

```bash
npm install
npm run dev
```

## Vercel

Állítsd be ugyanazt a két `VITE_SUPABASE_*` environment variable-t, majd deploy.
