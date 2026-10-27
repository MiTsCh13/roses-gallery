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
pnpm dev | pnpm test | pnpm test:e2e | pnpm lint | pnpm db:migrate
docker compose up -d   # Postgres + Redis lokal

## Regeln
- UI-Texte nur über next-intl (messages/de.json), nie hart codiert.
- Jede DB-Abfrage filtert nach accountId (Mandantentrennung).
- Medien nie öffentlich: nur signierte, kurzlebige URLs.
- Planlimits und Feature-Flags nur über lib/plans.ts prüfen.
- Preise in EUR, Beträge als Cent-Integer.
- Keine Plattform-Provision auf Verkäufe oder Trinkgeld.
- Neue Funktion = Test dazu. Vor jedem Commit: pnpm lint && pnpm test.
- Geheimnisse nur in .env.local, nie committen.
- Server Actions für Mutationen, Zod für jede Eingabe.
- Nur Anforderungen mit Priorität M bauen, solange der aktuelle Meilenstein nichts anderes sagt.
