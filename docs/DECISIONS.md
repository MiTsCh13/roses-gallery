# Entscheidungen

> Offene Punkte werden hier gesammelt, jeweils mit der Annahme, mit der vorerst
> weitergearbeitet wird. Der Mensch entscheidet, wann er will – die Entwicklung
> wartet nicht darauf. Erledigte Punkte wandern nach unten.

## Offen – Mensch gefragt

| ID | Frage | Vorläufige Annahme | Benötigt bis |
| --- | --- | --- | --- |
| D-001 | Plan-Namen und EUR-Preise | Platzhalter in `lib/plans.ts` (Spec) | vor Launch (M10) |
| D-002 | `ui.shadcn.com` in der Netzwerk-Allowlist der Cloud-Umgebung freigeben? | Komponenten werden manuell angelegt | nicht blockierend |
| D-004 | Branch-Schutz für `main` aktivieren (PR + grüne CI-Checks Pflicht)? | Disziplin per CLAUDE.md, kein technischer Schutz | empfohlen, sobald möglich |
| D-005 | Testzugänge: Postmark-Server-Token + Google-OAuth-Client (für echten Login-Test) | Entwicklung mit Fake-Mailer; Google-Login ungetestet gegen echtes Google | M1-Abnahme (optional) |
| D-006 | Stripe-Testmodus-Schlüssel + Webhook-Secret | Stripe-Client gemockt | M2-Abnahme |
| D-007 | Cloudflare-R2- und Bunny-Stream-Testzugänge | Storage-/Video-Interface mit Fakes | M3/M4-Abnahme |

Schlüssel bitte als Secrets in der Cloud-Umgebung (bzw. GitHub Actions Secrets) hinterlegen, nie ins Repo.

## Getroffen

| ID | Entscheidung | Begründung | Datum |
| --- | --- | --- | --- |
| D-100 | PRs werden von Claude selbst gemergt, sobald CI grün ist | Vorgabe Mitsch: minimaler Human-in-the-Loop | 2026-10-27 |
| D-101 | Externe Dienste zuerst gegen Mocks/Testmodi, echte Schlüssel erst bei Bedarf | Vorgabe Mitsch | 2026-10-27 |
| D-102 | Next.js 16.4 mit `cacheComponents` (Default von create-next-app) | aktueller Stand; Docs liegen in `node_modules/next/dist/docs` | 2026-10-27 |
| D-103 | postgres.js als Treiber für Drizzle | schlank, gut mit Drizzle unterstützt | 2026-10-27 |
| D-104 | Playwright auf 1.63.0 gepinnt | passt zum vorinstallierten Chromium der Cloud-Sessions | 2026-10-27 |
| D-003 | Auth.js v5 (`next-auth@5` beta) statt v4 | Spec verlangt Auth.js; Drizzle-Adapter und App Router sind auf v5 ausgelegt. Einwand bitte in M1 | 2026-10-27 |
| D-105 | Google-Login darf bestehende Magic-Link-Konten mit gleicher E-Mail verknüpfen (`allowDangerousEmailAccountLinking`) | Google liefert verifizierte Adressen; sonst `OAuthAccountNotLinked`. Einwand bitte in M1 | 2026-10-27 |
| D-106 | Auth.js nutzt Datenbank-Sessions (Adapter) statt JWT; Registrierung = erster Login legt Account + Owner-User an | Magic Link braucht ohnehin den Adapter; Sessions sind serverseitig widerrufbar | 2026-10-27 |
| D-107 | Fake-Mailer (`MAIL_TRANSPORT=fake`) + `/api/test/mailbox` nur in Nicht-Produktion oder mit `E2E_TEST_MODE=1` | E2E ohne echten Postmark-Zugang (D-005) | 2026-10-27 |
| D-108 | Neue Konten starten im Free-Plan (2 GB, 3 Galerien); die 14-Tage-Testphase ist ein Stripe-Trial beim Checkout des gewählten Plans. Abo-Status `past_due` behält den gebuchten Plan (Karenz), `canceled`/`none` → Free | Spec lässt Details offen; Free-Plan senkt die Einstiegshürde | 2026-10-27 |
