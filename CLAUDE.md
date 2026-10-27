# Roses Gallery

SaaS für Hochzeitsfotografen und -videografen im DACH-Raum:
gebrandete Foto- und Video-Galerien für ihre Kunden.
Spezifikation: docs/SPEC.md (Anforderungs-IDs wie F-UP-04).
Umsetzungsplan mit Meilensteinen: docs/UMSETZUNGSPLAN.md.

## Stack
Next.js (App Router), TypeScript strict, Tailwind, shadcn/ui,
Drizzle + PostgreSQL, BullMQ + Redis (Worker in /worker),
Auth.js, Cloudflare R2, Bunny Stream, Stripe, Postmark, next-intl.

## Befehle
pnpm dev | pnpm test | pnpm test:e2e | pnpm lint | pnpm typecheck | pnpm db:migrate
pnpm check             # lint + format:check + typecheck + test (vor jedem Commit)
pnpm worker            # BullMQ-Worker (worker/index.ts)
docker compose up -d   # Postgres + Redis lokal (in Cloud-Sessions ohne Docker:
                       # postgres/redis-server sind installiert, siehe docs/STATUS.md)

## Regeln
- UI-Texte nur über next-intl (messages/de.json), nie hart codiert.
- Jede DB-Abfrage filtert nach accountId (Mandantentrennung).
- Medien nie öffentlich: nur signierte, kurzlebige URLs.
- Planlimits und Feature-Flags nur über lib/plans.ts prüfen.
- Preise in EUR, Beträge als Cent-Integer.
- Keine Plattform-Provision auf Verkäufe oder Trinkgeld.
- Neue Funktion = Test dazu. Vor jedem Commit: pnpm check (bei UI-Änderungen auch pnpm test:e2e).
- Geheimnisse nur in .env.local, nie committen.
- Server Actions für Mutationen, Zod für jede Eingabe.
- Nur Anforderungen mit Priorität M bauen, solange der aktuelle Meilenstein nichts anderes sagt.

## Autonomer Arbeitsablauf (tägliche Routinen)
1. Zuerst docs/STATUS.md und docs/DECISIONS.md lesen – sie ersetzen lange Session-Verläufe.
2. Nächste offene, nicht blockierte Aufgabe aus STATUS.md nehmen. Fehlt eine Entscheidung:
   in DECISIONS.md eintragen (mit Annahme, falls vertretbar) und an einer anderen
   Aufgabe weiterarbeiten – nie auf Antwort warten.
3. Branch `claude/<meilenstein>-<thema>` von aktuellem main, kleine PRs.
   Statt Plan-Modus: kurzer Plan in die PR-Beschreibung.
4. Vor dem Push: pnpm check grün, Diff selbst kritisch prüfen (Security, Mandantentrennung).
5. PR öffnen; ist CI grün, selbst per Squash mergen. CI rot → Ursache beheben, nie Tests
   abschalten.
6. Am Ende STATUS.md aktualisieren (Log-Eintrag, nächste Schritte, Entscheidungsbedarf)
   und mit in den PR nehmen.
7. Keine echten Schlüssel nötig, solange Mocks/Testmodi reichen. Externe Dienste hinter
   einem Interface mit Fake-Implementierung für Tests.

Next.js-Hinweise des Frameworks: @AGENTS.md
