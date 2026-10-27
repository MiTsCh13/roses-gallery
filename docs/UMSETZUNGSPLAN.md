# Umsetzungsplan mit Claude Code

Roses Gallery entsteht in elf MVP-Meilensteinen, je einer pro Claude-Code-Sitzung, jeder endet mit lauffähigem, getestetem Code und einem Commit.

## Vorgehen

1. **Neue Sitzung pro Meilenstein:** mit `/clear` starten, damit der Kontext frisch ist.
2. **Plan-Modus zuerst:** den Start-Prompt einfügen, Claude Code im Plan-Modus einen Plan erstellen lassen, den Plan prüfen und erst dann umsetzen lassen.
3. **Selbst testen:** die App lokal starten und die Fertig-Kriterien des Meilensteins durchklicken.
4. **Commit und Push:** erst wenn Tests und Lint grün sind. Danach `docs/SPEC.md` aktualisieren, falls sich etwas geändert hat.

Faustregel: Wenn ein Meilenstein mehr als eine Sitzung braucht, teile ihn. Fehler sofort mit Fehlermeldung und Screenshot zurückgeben.

## Voraussetzungen

**Konten:** GitHub, Cloudflare (R2), Bunny.net, Stripe (Testmodus), Postmark, Sentry; Hetzner-Server vorhanden. Die API-Schlüssel trägst du selbst in `.env.local` ein; Claude Code legt dafür eine `.env.example` an.

**Lokal installiert:** Node.js 22, pnpm, Docker Desktop, Git, Claude Code.

## MVP-Meilensteine

| # | Meilenstein | Anforderungen | Fertig, wenn |
| --- | --- | --- | --- |
| M0 | Projekt-Setup | – | `pnpm dev` läuft, CI grün, CLAUDE.md liegt im Repo |
| M1 | Datenmodell & Login | F-ACC-01 | Creator kann sich registrieren und einloggen |
| M2 | Abo & Planlimits | F-ACC-02 bis 04 | Testabo über Stripe abschließbar, Limits greifen |
| M3 | Foto-Upload & Verarbeitung | F-UP-01 bis 03, 05 | 500 Fotos hochgeladen, Größen erzeugt, Speicher verbucht |
| M4 | Video über Bunny Stream | F-UP-04 | 4K-Video hochgeladen und im Dashboard abspielbar |
| M5 | Galerie-Verwaltung | F-GAL-01 bis 04, F-DASH-01 | Galerie mit Sets anlegen, sortieren, veröffentlichen |
| M6 | Design-Editor | F-DES-01 bis 03 | 4 Themes mit Live-Vorschau Desktop und Mobil |
| M7 | Galerie-Ansicht & Player | F-VID-01 bis 03, F-GAL-03 | Kunde sieht Netflix-Ansicht, Video läuft auf TV |
| M8 | Zugriff, Downloads, Favoriten | F-SEC-01 bis 03, F-INT-01, 02 | Passwort, ZIP-Download, Wasserzeichen, Favoritenlisten |
| M9 | Auslieferung & Statistik | F-DASH-02, 03 | Auslieferungs-Mail kommt an, Aufrufe werden gezählt |
| M10 | Härtung & Launch | Nicht-funktionale Anforderungen | Produktion auf Hetzner, Impressum und Datenschutz online |

### M0 – Projekt-Setup

```text
Lies CLAUDE.md und docs/SPEC.md (Abschnitt Systemarchitektur). Lege im aktuellen
Ordner ein Next.js-Projekt mit TypeScript strict, Tailwind, shadcn/ui, ESLint und
Prettier an, ohne CLAUDE.md und docs/ zu überschreiben. Richte ein: Drizzle mit
PostgreSQL, docker-compose für Postgres und Redis, next-intl mit Deutsch als
einziger Sprache, Vitest, Playwright, einen /worker-Ordner für BullMQ-Jobs,
.env.example und eine GitHub-Actions-CI mit lint und test. Zeig mir zuerst den Plan.
```

### M1 – Datenmodell & Login

```text
Lies docs/SPEC.md (Datenmodell, Rollen, F-ACC-01). Lege das Drizzle-Schema für
Account, User, Gallery, Set, Media, Visitor, FavoriteList, Favorite, Theme und
Event an (FaceEmbedding, Product, Order, Tip, Review noch nicht). Richte Auth.js mit
Magic Link über Postmark und Google-Login ein. Bei der Registrierung entsteht ein
Account. Baue einen Helper, der jede Abfrage auf die accountId einschränkt, und
teste, dass ein Creator keine fremden Galerien lesen kann.
```

### M2 – Abo & Planlimits

```text
Lies docs/SPEC.md (F-ACC-02 bis 04, Preismodell). Lege lib/plans.ts mit den
Plänen in EUR an (Speicher und Feature-Flags je Plan, Preise als Platzhalter).
Binde Stripe Billing an: 14 Tage Test, Checkout, Webhooks für Abo-Status,
Customer Portal für Wechsel und Kündigung. Baue eine Prüfung, die Uploads über
dem Speicherlimit und Features außerhalb des Plans blockiert, mit Tests.
```

### M3 – Foto-Upload & Verarbeitung

```text
Lies docs/SPEC.md (F-UP-01 bis 03, F-UP-05). Baue Bulk-Upload mit Uppy direkt
nach Cloudflare R2 über signierte Multipart-URLs, fortsetzbar. Nach dem Upload legt
die API einen BullMQ-Job an; der Worker erzeugt mit sharp Größen 400, 1200 und
2400 px als WebP, liest das EXIF-Datum und bucht den Speicher auf den Account.
Ersetzen einer Datei behält ID, Position und Favoriten. Zeige den Fortschritt im UI.
```

### M4 – Video über Bunny Stream

```text
Lies docs/SPEC.md (F-UP-04). Binde Bunny Stream an: Video-Objekt per API anlegen,
Upload direkt aus dem Browser per tus, Webhook für den Verarbeitungsstatus, Dauer
und Größe in Media speichern und auf den Speicher buchen. Wiedergabe nur über
signierte Token-URLs. Für den Download bleibt das Original abrufbar.
Lege einen Bunny-Testmodus an, damit Tests ohne echte Uploads laufen.
```

### M5 – Galerie-Verwaltung

```text
Lies docs/SPEC.md (F-GAL-01 bis 04, F-DASH-01). Baue im Dashboard: Galerie anlegen
und bearbeiten (Titel, Datum, Slug, Cover, Status, Ablaufdatum), Foto- und
Video-Sets mit Drag-and-Drop-Sortierung von Sets und Medien, Galerie-Übersicht mit
Status, Speicher und Ablauf. Ein täglicher Job setzt abgelaufene Galerien auf
"abgelaufen" und schickt 7 Tage vorher eine Erinnerung.
```

### M6 – Design-Editor

```text
Lies docs/SPEC.md (F-DES-01 bis 03). Baue 4 Themes als Konfiguration (Schrift,
Farben, Raster-Layout, Cover-Stil) und einen Editor mit Live-Vorschau, umschaltbar
zwischen Desktop und Mobil. Logo-Upload pro Account, sichtbar in jeder Galerie.
Die Vorschau rendert dieselben Komponenten wie die echte Galerie-Ansicht.
```

### M7 – Galerie-Ansicht & Player

```text
Lies docs/SPEC.md (F-VID-01 bis 03, F-GAL-03, Nicht-funktionale Anforderungen).
Baue die öffentliche Galerie unter /g/[slug], mobile-first, server-gerendert:
Cover, Netflix-artige Video-Reihen, Foto-Raster mit Lightbox, Theme angewendet.
Video-Player mit hls.js, Qualitätswahl, Fortsetzen an letzter Position, AirPlay
in Safari und Chromecast über das Google Cast SDK. Ziel: LCP unter 2,5 s auf 4G.
```

### M8 – Zugriff, Downloads, Favoriten

```text
Lies docs/SPEC.md (F-SEC-01 bis 03, F-INT-01, F-INT-02). Baue: Passwortschutz pro
Galerie mit Rate-Limit, Download-Rechte je Galerie und Set (aus, Web-Größe,
Original), ZIP-Download als Worker-Job mit Mail-Link, Wasserzeichen auf
Web-Größen, Favoriten mit mehreren Listen ohne Konto (Magic Link für Kunden),
Export der Liste an den Creator und Teilen als Instagram-Story-Bild.
```

### M9 – Auslieferung & Statistik

```text
Lies docs/SPEC.md (F-DASH-02, F-DASH-03). Baue die Auslieferungs-Mail über
Postmark mit anpassbarem Text und Creator-Logo. Erfasse Events (Aufruf,
Video-Start, Download, Favorit) datensparsam ohne Cookies und zeige pro Galerie
Statistiken im Dashboard.
```

### M10 – Härtung & Launch

```text
Lies docs/SPEC.md (Nicht-funktionale Anforderungen). Prüfe die App gegen jede
Zeile der Tabelle und erstelle eine Liste der Lücken, dann behebe sie: Sentry,
Rate-Limits, Security-Header, 2FA für Creator, Barrierefreiheit der Galerie
(WCAG 2.1 AA), Lighthouse-Check, tägliches DB-Backup. Erstelle ein Deployment
für meinen bestehenden Hetzner-Server mit Coolify (App, Worker, Postgres, Redis)
und Seiten für Impressum, Datenschutz und AGB als Platzhalter.
```

Rechtstexte (Impressum, Datenschutzerklärung, AGB, AV-Vertrag) lässt du vor dem Launch von einem Anwalt oder einem Generator wie eRecht24 erstellen; Claude Code baut nur die Seiten.

## Phase 2 nach dem MVP

| # | Meilenstein | Anforderungen |
| --- | --- | --- |
| P2-1 | Premiere mit Countdown | F-PRE-01, 02 |
| P2-2 | White-Label-Subdomains mit automatischem TLS | F-WL-01, 02 |
| P2-3 | Digitaler Shop und Trinkgeld über Stripe Connect, 0 % Provision | F-SALE-01 bis 03 |
| P2-4 | Bewertungen und Benachrichtigungen | F-INT-03, F-DASH-04 |
| P2-5 | Video-Kapitel, Video-Cover, Galerie-Musik, Branding & Socials | F-VID-04, F-DES-04 bis 06 |
| P2-6 | Website-Embeds und externe Download-Links | F-VID-05, F-UP-06 |
| P2-7 | Galerie duplizieren, Vorlagen, getrennte PINs | F-GAL-05, F-SEC-04 |

Find my Face, Druck-Partner und Teams bleiben in Phase 3.
