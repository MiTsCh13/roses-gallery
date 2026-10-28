# Projektstatus

> Wird am Ende jeder Session aktualisiert. Neue Sessions lesen zuerst diese Datei
> und `docs/DECISIONS.md`. Log kurz halten (max. 10 Einträge, ältere löschen –
> die Git-Historie bleibt).

**Aktueller Meilenstein:** M4 – Video über Bunny Stream
**Stand main:** M0–M2 abgeschlossen (M2: Abnahme gegen echtes Stripe offen, D-006)

## Meilensteine

| # | Meilenstein | Status |
| --- | --- | --- |
| M0 | Projekt-Setup | ✅ fertig |
| M1 | Datenmodell & Login | ✅ fertig |
| M2 | Abo & Planlimits | ✅ fertig (Stripe nur gegen Fake getestet) |
| M3 | Foto-Upload & Verarbeitung | ✅ fertig (Limit „Galerie anlegen“ folgt mit M5) |
| M4 | Video über Bunny Stream | 🚧 in Arbeit |
| M5 | Galerie-Verwaltung | offen |
| M6 | Design-Editor | offen |
| M7 | Galerie-Ansicht & Player | offen |
| M8 | Zugriff, Downloads, Favoriten | offen |
| M9 | Auslieferung & Statistik | offen |
| M10 | Härtung & Launch | offen |

## Nächste Schritte (M4, in dieser Reihenfolge)

- [x] Bunny-Smoke-Test (2026-10-28): Library erreichbar, API-Key gültig
- [x] `VideoProvider` (Bunny + Fake, `VIDEO_TRANSPORT`), `lib/videos.ts` (start → tus-Parameter, Sync, Buchung genau einmal bei `ready`, signierte Embed-URL, Löschen), API `/api/videos/{start,refresh,playback,remove}`, Webhook `/api/bunny/webhook` (Body nicht vertraut, Status wird per API geholt). Gegen echtes Bunny nur Smoke-Test, kein Upload
- [x] Upload-UI für Video-Sets (`VideoUploader`, tus-js-client, Fortschritt, Abbrechen) + Player-Vorschau (signierte Embed-URL erst per Klick) auf `/dashboard/sets/[setId]`; Seite zieht den Status offener Videos selbst nach (webhook-unabhängig). E2E gegen Fake-tus (`/api/test/tus`). Offen: Fortsetzen nach Reload
- [x] Original-Download: signierte CDN-URL (`signOriginalUrl`, Token `base64url(sha256(key+pfad+expires))`), Aktion `/api/videos/original`, Button im Dashboard. **Live ungeprüft:** `BUNNY_STREAM_CDN_HOSTNAME` steht erst im nächsten Lauf in der Umgebung → dann Original-URL des Test-Videos abrufen (Token-Pfad-Format prüfen)
- [ ] Fertig-Kriterium M4: Upload→Encoding, 4K (D-118) und Embed-Token live verifiziert. **Offen nur Original-URL live:** 403 mit dem Embed-Key, vermutlich eigener Pull-Zone-Key → D-117 (Mitsch)
- [x] Limit „Galerie anlegen“ (`assertCanCreateGallery`) mit M5

## Vorbereitet: M5 (Galerie-Verwaltung), nächste Schritte nach M4-Rest

- [x] Galerie anlegen/bearbeiten (`lib/galleries.ts`, Server Actions + Zod, Slug eindeutig je Account, Status inkl. neuem Wert `expired`, `assertCanCreateGallery` verdrahtet), Sets anlegen (Foto/Video), Übersicht `/dashboard/galleries` mit Status, Medien, Speicher, Ablauf
- [ ] Drag-and-Drop-Sortierung von Sets und Medien (`position`), `/api/test/seed-set` durch die echte UI in den E2E-Tests ablösen
- [ ] Cover wählen; Galerie-Übersicht mit Status, Speicher, Ablauf (F-DASH-01)
- [ ] Täglicher Job: abgelaufene Galerien → „abgelaufen“, Erinnerung 7 Tage vorher (Postmark-Fake)
- [ ] Miniaturen im Dashboard über signierte Varianten-URLs

## Entscheidungsbedarf

D-117: Bunny-Pull-Zone-Token-Key als `BUNNY_STREAM_CDN_TOKEN_KEY` hinterlegen (blockiert nur die Live-Abnahme des Original-Downloads, nicht M5).

## Umgebung (Cloud-Sessions)

- Node 22, pnpm 10, Postgres 16 und Redis 7 als Binaries vorhanden; **kein Docker-Daemon** →
  für Integrationstests `postgres`/`redis-server` direkt starten (Hilfsskript folgt in M1).
- `ui.shadcn.com` ist im Netzwerk gesperrt → shadcn-Komponenten manuell aus dem
  Registry-Quelltext anlegen (siehe D-002).
- SessionStart-Hook (`.claude/hooks/session-start.sh`) installiert Abhängigkeiten.

## Log

### 2026-10-28 – M5 Galerie anlegen
- Migration 0003 (`gallery_status` + `expired`), `lib/galleries.ts`, Dashboard-Seiten für Übersicht/Anlegen/Bearbeiten/Sets, Unit-Tests gegen Postgres, E2E. Hinweis E2E: mit Cache Components bleiben Vorseiten im DOM → Locators über Rollen statt `getByLabel`. Cloud: DB `roses_gallery` für E2E zusätzlich anlegen. D-117 weiter offen.

### 2026-10-28 – M4 Live-Abnahme
- 4K-Upload live grün; Original-URL 403 → optionaler `BUNNY_STREAM_CDN_TOKEN_KEY` (Fallback Embed-Key), Tests ergänzt. Frage D-117 offen.

### 2026-10-28 – M4 Original-Download
- D-115 erledigt (Keep Originals, Allowlist, CDN-Hostname). Embed-Token live bestätigt. Original-URL + Download-Button, Tests inkl. E2E.

### 2026-10-28 – M4 Video-UI
- Video-Sets in der Set-Seite, Fake-tus-Server und Test-Routen (`video-ready`, `player`) nur Nicht-Produktion/E2E; E2E setzt `VIDEO_TRANSPORT=fake`.

### 2026-10-28 – M4 Bunny-Backend
- Provider-Interface + Fake + Bunny, Video-Upload-API, Webhook, Buchung auf den Speicher beim Übergang zu `ready`. Tests gegen echtes Postgres bzw. gemocktes fetch. M3 abgeschlossen. Hinweis Cloud: Rolle/DB `roses` und `roses_gallery_test` müssen in frischer Umgebung per `su postgres` angelegt werden.

### 2026-10-28 – M3 Aufräumen
- Wartungsjob für verwaiste/steckengebliebene `pending`-Uploads, im Worker als Job-Scheduler (stündlich). Tests gegen echtes Postgres.

### 2026-10-27 – M3 Upload-UI
- `lib/upload-client.ts` (Multipart je Teil mit Retry/neuer Signatur, Abbruch → `abort`), `PhotoUploader`, Set-Seite mit Foto-Liste und Auto-Refresh bei `pending`; Test-Route `/api/test/seed-set` bis M5. CI-E2E bekommt Redis (Enqueue in `complete`), E2E nutzt `STORAGE_TRANSPORT=fake`.

### 2026-10-27 – M3 Ersetzen (Revision)
- Eigener Multipart-Ablauf für Ersetzungen; live bleibt die alte Revision bis der neue Upload komplett ist. Tests gegen echtes Postgres (Revision, Byte-Freigabe, Quota, Mandantentrennung). Alte Revisionen werden nicht archiviert (Annahme; Spec F-UP-05 verlangt nur Erhalt von URL/Favoriten/Reihenfolge).

### 2026-10-27 – M3 process-photo
- Job `process-photo` (Zod-Payload, idempotent, accountId-gefiltert), Varianten in `media.variants`, `width/height/takenAt`; Fehler → Status `failed` + BullMQ-Retry. HEIC/RAW noch nicht (Upload-API erlaubt nur JPEG/PNG/WebP/TIFF).

### 2026-10-27 – M3 Upload-API
- `lib/uploads.ts` (Zod, Quota-Check beim Start und mit echter Größe beim Abschluss, accountId-Filter), Route `/api/uploads/[action]`, Fake-Storage-Route `/api/test/storage` (nur Nicht-Produktion/E2E). Tests gegen echtes Postgres.

### 2026-10-27 – M3 Storage
- `Storage`-Interface + `FakeStorage` (HMAC-signierte URLs) + `R2Storage`; `STORAGE_TRANSPORT`.

### 2026-10-27 – D-001 umgesetzt
- Pläne: Free / Bud 10 € / Bloom 20 € / Bouquet 50 € / Enterprise (auf Anfrage), `PURCHASABLE_PLAN_IDS` für Checkout; Enterprise-Karte auf der Abo-Seite.

### 2026-10-27 – M2 abgeschlossen
- Fertig-Kriterium: Testabo-Fluss (Checkout → Webhook → Plan) per E2E gegen Fake, Limits per Unit-Tests. Echte Stripe-Abnahme wartet auf D-006. M3 aufgeschlüsselt.

### 2026-10-27 – M2 Abo-Seite
- `/dashboard/billing`: Plan, Status, Trial-Ende, Speicherbalken, Plan-Wahl (monatlich/jährlich) → Checkout, „Abo verwalten“ → Portal. E2E mit Fake-Billing inkl. simuliertem Webhook.

### 2026-10-27 – M2 Billing-Backend
- `lib/billing`: `BillingProvider` (Stripe + Fake, `BILLING_TRANSPORT`), Checkout mit `price_data` in EUR + 14 Tage Trial, Portal-Session, Webhook `/api/stripe/webhook` (Signaturprüfung, veraltete Events werden ignoriert via `billing_event_at`). Gegen echtes Stripe ungetestet (D-006).

### 2026-10-27 – M2 Planlimits
- `lib/plans.ts` mit Platzhalterplänen (D-001), Abo-Spalten am Account, Tests der Limit-/Feature-Prüfung. M1-Fertig-Kriterium (Registrieren + Einloggen) per E2E erfüllt.

### 2026-10-27 – M1 Datenmodell (Teil 1)
- Drizzle-Schema + Migration (inkl. Auth.js-Tabellen `auth_*`), DB-Integrationstests gegen echtes Postgres (CI-Service-Container; lokal: `service postgresql start`, Rolle/DB `roses`).
- `src/db/tenant.ts`: `tenantDb(db, accountId)` erzwingt accountId bei list/get/create/update/remove; Test „Creator liest keine fremde Galerie“.

### 2026-10-27 – M1 Auth
- Auth.js v5: Magic Link (Postmark-Mailer + Fake-Mailer, `MAIL_TRANSPORT`), optional Google; Adapter legt bei Registrierung Account + Owner-User an. `/login`, `/login/check-email`, `/dashboard` (Platzhalter), E2E des Magic-Link-Flows (CI-E2E mit Postgres).
- `.env.local` für Dev: `AUTH_SECRET` (≥16 Zeichen), `AUTH_URL`; ohne Postmark-Token wird automatisch der Fake-Mailer genutzt (nur Nicht-Produktion).

### 2026-10-27 – M0 Projekt-Setup
- Spec, Umsetzungsplan, CLAUDE.md nach `main`.
- Next.js 16.4 (App Router, Cache Components), TypeScript strict, Tailwind 4, shadcn/ui-Basis (Button), ESLint + Prettier.
- next-intl (nur Deutsch, `messages/de.json`), Drizzle + postgres.js, docker-compose (Postgres 16, Redis 7), BullMQ-Queue-Registry mit Zod-Validierung + Worker (`pnpm worker`, lokal gegen Redis verifiziert).
- Vitest (12 Unit-Tests), Playwright (Desktop + Mobil, 6 Tests), Security-Header, `/api/health`.
- GitHub Actions: lint/format/typecheck/unit, E2E, `pnpm audit` + gitleaks; Dependabot.
