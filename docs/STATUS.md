# Projektstatus

> Wird am Ende jeder Session aktualisiert. Neue Sessions lesen zuerst diese Datei
> und `docs/DECISIONS.md`. Log kurz halten (max. 10 Einträge, ältere löschen –
> die Git-Historie bleibt).

**Aktueller Meilenstein:** M1 – Datenmodell & Login
**Stand main:** M0 abgeschlossen

## Meilensteine

| # | Meilenstein | Status |
| --- | --- | --- |
| M0 | Projekt-Setup | ✅ fertig |
| M1 | Datenmodell & Login | ⏭️ als Nächstes |
| M2 | Abo & Planlimits | offen |
| M3 | Foto-Upload & Verarbeitung | offen |
| M4 | Video über Bunny Stream | offen |
| M5 | Galerie-Verwaltung | offen |
| M6 | Design-Editor | offen |
| M7 | Galerie-Ansicht & Player | offen |
| M8 | Zugriff, Downloads, Favoriten | offen |
| M9 | Auslieferung & Statistik | offen |
| M10 | Härtung & Launch | offen |

## Nächste Schritte (M1, in dieser Reihenfolge)

- [x] Drizzle-Schema: Account, User, Gallery, Set, Media, Visitor, FavoriteList, Favorite, Theme, Event (+ Auth.js-Tabellen), erste Migration
- [x] DB-Integrationstests gegen echtes Postgres (lokal: `postgres` 16 installiert; CI: Service-Container)
- [x] Mandanten-Helper: jede Abfrage auf accountId eingeschränkt + Test „Creator liest keine fremde Galerie“
- [x] Auth.js: Magic Link (Postmark, mit Fake-Transport für Tests) und Google-Login; Registrierung legt Account an
- [x] Login-/Registrierungsseiten (Texte via next-intl), E2E-Test des Magic-Link-Flows mit Fake-Mailer

## Entscheidungsbedarf

Siehe `docs/DECISIONS.md` → Abschnitt „Offen“. Nichts davon blockiert M1.

## Umgebung (Cloud-Sessions)

- Node 22, pnpm 10, Postgres 16 und Redis 7 als Binaries vorhanden; **kein Docker-Daemon** →
  für Integrationstests `postgres`/`redis-server` direkt starten (Hilfsskript folgt in M1).
- `ui.shadcn.com` ist im Netzwerk gesperrt → shadcn-Komponenten manuell aus dem
  Registry-Quelltext anlegen (siehe D-002).
- SessionStart-Hook (`.claude/hooks/session-start.sh`) installiert Abhängigkeiten.

## Log

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
