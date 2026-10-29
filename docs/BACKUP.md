# Datenbank-Backup und Wiederherstellung

## Ablauf
- Worker-Job `db-backup` läuft täglich um 02:30 (Server-Zeit) und lädt `pg_dump` (Plain-SQL, gzip) nach `backups/db-<JJJJ-MM-TT>.sql.gz` in den R2-Bucket.
- Aufbewahrung: 30 Tage. Bei jedem Lauf wird das Backup gelöscht, das aus dem Fenster fällt (`lib/db-backup.ts`).
- Der Worker-Container braucht den Client `pg_dump` (Version = Postgres-Version, derzeit 16, z. B. `postgresql-client-16`).
- Medien liegen selbst in R2 und werden nicht gesichert (R2-Versionierung bei Bedarf in Cloudflare aktivieren).
- Schlägt der Job fehl, meldet ihn Sentry (`failed`-Handler im Worker, D-130).

## Wiederherstellung
1. Backup holen (Cloudflare-Dashboard → R2 → Bucket → `backups/`, oder `aws s3 cp` gegen den R2-Endpoint).
2. Leere Datenbank anlegen: `createdb roses_gallery_restore`.
3. Einspielen: `gunzip -c db-2026-10-29.sql.gz | psql "$RESTORE_DATABASE_URL"`.
4. App/Worker auf die neue `DATABASE_URL` zeigen lassen, `pnpm db:migrate` ausführen (nur nötig, wenn das Backup älter als das letzte Release ist).
5. Stichprobe: Anmeldung, Galerie öffnen, Statistik.

Probe der Wiederherstellung vor dem Launch einmal durchführen (Zugang nötig, siehe DECISIONS D-135).
