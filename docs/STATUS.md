# Projektstatus

> Wird am Ende jeder Session aktualisiert. Neue Sessions lesen zuerst diese Datei
> und `docs/DECISIONS.md`. Log kurz halten (max. 10 Einträge, ältere löschen –
> die Git-Historie bleibt).

**Aktueller Meilenstein:** M2 – Abo & Planlimits
**Stand main:** M0, M1 abgeschlossen

## Meilensteine

| # | Meilenstein | Status |
| --- | --- | --- |
| M0 | Projekt-Setup | ✅ fertig |
| M1 | Datenmodell & Login | ✅ fertig |
| M2 | Abo & Planlimits | ⏭️ in Arbeit |
| M3 | Foto-Upload & Verarbeitung | offen |
| M4 | Video über Bunny Stream | offen |
| M5 | Galerie-Verwaltung | offen |
| M6 | Design-Editor | offen |
| M7 | Galerie-Ansicht & Player | offen |
| M8 | Zugriff, Downloads, Favoriten | offen |
| M9 | Auslieferung & Statistik | offen |
| M10 | Härtung & Launch | offen |

## Nächste Schritte (M2, in dieser Reihenfolge)

- [x] `lib/plans.ts` (Pläne, Limits, Feature-Flags, `assertCanUpload` etc.) + Abo-Felder am Account (Migration 0001)
- [x] Billing-Interface (`BillingProvider`) mit Fake + Stripe-Implementierung: Checkout-Session (14 Tage Test, monatlich/jährlich), Customer-Portal-Session
- [x] Stripe-Webhook `/api/stripe/webhook` (Signaturprüfung, idempotent): Abo-Status/Plan/Trial-Ende auf Account schreiben
- [ ] Abo-Seite im Dashboard (Plan wählen, Portal öffnen, Speicherverbrauch) + E2E mit Fake-Billing
- [ ] Limits in Server Actions verdrahten (Galerie anlegen, Upload-Start) – sobald diese Actions existieren (M3/M5)

## Entscheidungsbedarf

Siehe `docs/DECISIONS.md` → Abschnitt „Offen“. Nichts davon blockiert M1.

## Umgebung (Cloud-Sessions)

- Node 22, pnpm 10, Postgres 16 und Redis 7 als Binaries vorhanden; **kein Docker-Daemon** →
  für Integrationstests `postgres`/`redis-server` direkt starten (Hilfsskript folgt in M1).
- `ui.shadcn.com` ist im Netzwerk gesperrt → shadcn-Komponenten manuell aus dem
  Registry-Quelltext anlegen (siehe D-002).
- SessionStart-Hook (`.claude/hooks/session-start.sh`) installiert Abhängigkeiten.

## Log

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
