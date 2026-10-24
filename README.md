# AI Post Assistant

Private, single-user workspace for turning your existing images and videos into platform-ready social post copy. The app does not create or edit the media itself.

## Stage 1: foundation

- Next.js App Router + TypeScript.
- One shared password (no username/account system).
- Signed, HTTP-only session cookie; password is stored as a hash in environment configuration.
- Supabase schema and private storage policy are defined in `supabase/migrations/`.
- No social auto-publishing; no AI provider calls in this stage.

## Local setup

1. Install Node.js 20.9+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `APP_PASSWORD_HASH` to a PBKDF2-SHA256 hash in the format `pbkdf2$310000$<32-hex-char-salt>$<64-hex-char-hash>`, and set `SESSION_SECRET` to a random secret of at least 32 bytes. The initial deployment password is generated separately; do not commit its plaintext.
5. Run `npm run dev`.

Never commit `.env.local`, service-role keys, or provider API keys. Do not expose `SUPABASE_SERVICE_ROLE_KEY` through a `NEXT_PUBLIC_` variable.

## Storage policy

Original media is retained until the user deletes its project. The initial per-file upload limit is 50 MB. Supabase quotas still apply. Project deletion must remove the project's assets and generated records before removing its storage objects.

## Planned stages

1. Foundation/access/database/private storage.
2. Image upload, multimodal analysis, OCR, and review.
3. Content editor, autosave, and version history.
4. Video processing pipeline.
5. Batch, carousel, and mixed campaigns.
6. Projects, planning calendar, history, and preferences.
7. Security, cost controls, deployment, and final verification.
