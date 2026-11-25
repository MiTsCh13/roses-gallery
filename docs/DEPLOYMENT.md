# Deployment auf Hetzner mit Coolify

> **Ungeprüft:** `Dockerfile` und `docker-compose.prod.yml` konnten in der Cloud-Umgebung nicht gebaut werden (kein Docker-Daemon). Erster Build auf dem Server = Abnahme (D-136).

## Aufbau
Eine Compose-Ressource in Coolify mit vier Diensten:

| Dienst | Aufgabe |
| --- | --- |
| `app` | Next.js (`pnpm start`), führt vor dem Start `pnpm db:migrate` aus, Healthcheck `/api/health` |
| `worker` | BullMQ-Worker (`pnpm worker`): Foto-Verarbeitung, ZIP, Ablauf-Mails, Aufräumen, DB-Backup |
| `postgres` | PostgreSQL 16, Volume `postgres-data` |
| `redis` | Redis 7 (AOF), Volume `redis-data` |

`app` und `worker` nutzen dasselbe Image (`Dockerfile`, enthält `pg_dump` 16 für das Backup, `docs/BACKUP.md`).

## Einrichtung
1. In Coolify: Neue Ressource → Git-Repository `MiTsCh13/roses-gallery` → Build Pack **Docker Compose**, Datei `docker-compose.prod.yml`.
2. Domain dem Dienst `app` zuweisen (Port 3000), TLS über Coolify/Let's Encrypt.
   **www:** Im DNS einen Eintrag für `www` anlegen (A/AAAA auf den Server oder CNAME auf `roses-gallery.app`). In Coolify beim Dienst `app` beide Domains eintragen: `https://roses-gallery.app,https://www.roses-gallery.app` (Coolify holt dann auch für `www` ein Zertifikat). Falls vorhanden, unter „Direction“ *Redirect to non-www* wählen. Erreicht die www-Anfrage die App, leitet sie zusätzlich selbst per 308 auf die Apex-Domain um (`src/lib/www-redirect.ts`).
3. Umgebungsvariablen in Coolify setzen (Namen siehe `.env.example` und `docs/ZUGAENGE.md`). Pflicht: `LEGAL_NAME`, `LEGAL_ADDRESS`, `LEGAL_EMAIL`, `LEGAL_PHONE`, optional `LEGAL_VAT_ID` (leer = Abschnitt „Umsatzsteuer-ID“ im Impressum entfällt) (Impressum/Datenschutz/AGB, Adresse in einer Zeile; leer = Hinweis „bitte ergänzen“ auf der Seite), `POSTGRES_PASSWORD`, `AUTH_SECRET`, `AUTH_URL` (z. B. `https://roses-gallery.app`; Website-Metadaten, Sitemap, robots.txt und RSS werden beim Build vorgerendert und nehmen `AUTH_URL` aus der Build-Umgebung, ohne Wert gilt `https://roses-gallery.app`), `EMAIL_FROM`, `POSTMARK_SERVER_TOKEN`, `STRIPE_*`, `R2_*`, `BUNNY_STREAM_*`. Optional: `BUNNY_STREAM_CDN_*`, `SENTRY_DSN` (leer = aus), `BETA_MODE=1` für die Beta-Phase (D-159; **auch als Build-Variable** anhaken, weil Preisseite und Kopfzeile beim Build vorgerendert werden; Änderung wirkt nach dem nächsten Deploy). **Nie** `E2E_TEST_MODE` und keine `*_TRANSPORT=fake` setzen.
4. Deploy auslösen. Beim ersten Start legt `pnpm db:migrate` das Schema an.
5. Stripe-Webhook auf `https://<domain>/api/stripe/webhook`, Bunny-Webhook auf `https://<domain>/api/bunny/webhook` eintragen.
6. Prüfen: `/api/health`, Anmeldung per Magic Link, Galerie anlegen, Foto hochladen, `/impressum` erreichbar.

## Sicherheit
- Der Reverse Proxy (Traefik in Coolify) muss `x-forwarded-for` selbst setzen bzw. überschreiben, sonst lassen sich die Rate-Limits (D-122, D-132) mit gefälschtem Header umgehen. Traefik überschreibt den Header für nicht vertraute Clients – nach dem ersten Deploy mit `curl -H 'x-forwarded-for: 1.2.3.4'` gegen einen Rate-Limit-Endpunkt prüfen.
- Postgres und Redis haben keine veröffentlichten Ports (nur internes Compose-Netz).
- Geheimnisse nur in Coolify, nie im Repo.

## Updates
Push auf `main` → Coolify baut neu (Webhook aktivieren) oder manuell „Redeploy“. Migrationen laufen beim Start des `app`-Containers.
