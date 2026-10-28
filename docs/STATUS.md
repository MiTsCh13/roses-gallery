# Projektstatus

> Wird am Ende jeder Session aktualisiert. Neue Sessions lesen zuerst diese Datei
> und `docs/DECISIONS.md`. Log kurz halten (max. 10 Einträge, ältere löschen –
> die Git-Historie bleibt).

**Aktueller Meilenstein:** M7 – Galerie-Ansicht & Player (M4-Rest: nur Live-Abnahme Original-URL, D-117)
**Stand main:** M0–M3, M5 und M6 abgeschlossen (M2: Abnahme gegen echtes Stripe offen, D-006; M4: Original-URL live offen, D-117)

## Meilensteine

| # | Meilenstein | Status |
| --- | --- | --- |
| M0 | Projekt-Setup | ✅ fertig |
| M1 | Datenmodell & Login | ✅ fertig |
| M2 | Abo & Planlimits | ✅ fertig (Stripe nur gegen Fake getestet) |
| M3 | Foto-Upload & Verarbeitung | ✅ fertig (Limit „Galerie anlegen“ folgt mit M5) |
| M4 | Video über Bunny Stream | ✅ fertig bis auf Live-Abnahme Original-URL (D-117) |
| M5 | Galerie-Verwaltung | ✅ fertig (Reste unten) |
| M6 | Design-Editor | ✅ fertig |
| M7 | Galerie-Ansicht & Player | 🚧 offen, aufgeschlüsselt |
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

## Nächste Schritte (M7, in dieser Reihenfolge)

- [x] Öffentliche Route `/g/[slug]` (`lib/public-gallery.ts`, `noindex`): nur `published` und nicht abgelaufen, sonst `notFound`; Theme/Overrides + Logo über `GalleryView`; Slugs global eindeutig (Migration 0007 benennt Dubletten um, `freeSlug` global, Retry bei Race). Hinweis: `notFound` kommt im gestreamten Suspense-Shell, daher HTTP 200 mit Not-Found-Inhalt (E2E prüft Inhalt). Cover/Fotos folgen im nächsten Schritt
- [x] Foto-Sets: Raster mit echten Fotos (signierte Varianten 1 h, `srcset` 400/1200/2400, lazy loading), Cover aus `coverMediaId` (größte Variante); nur `ready`-Fotos. Kein E2E mit echten Bildern (Worker läuft in E2E nicht) – Unit-Tests gegen Postgres + Komponententest
- [x] Lightbox (`lightbox.tsx`, `gallery-grid.tsx` jetzt Client-Komponente): Klick öffnet, Pfeiltasten/Buttons/Wischen, Esc, Fokus + Scroll-Sperre; `/g/[slug]` reicht Fotos und Cover jetzt tatsächlich durch (zuvor `tiles: []`). Tests als jsdom-Komponententests; kein E2E mit echten Bildern (Worker läuft in E2E nicht)
- [ ] Video-Reihen im Netflix-Stil (Hero-Video + Reihen je Video-Set), Hybrid-Galerie (F-GAL-03)
- [ ] HLS-Player (hls.js): Qualitätswahl, Vollbild, Fortsetzen an letzter Position (localStorage)
- [ ] AirPlay (Safari) und Chromecast (Cast SDK) – Fake/Feature-Detection für Tests
- [ ] Performance: LCP < 2,5 s auf 4G prüfen (Lighthouse), Fertig-Kriterium M7

## Nächste Schritte (M6, erledigt)

- [x] Theme-Konfiguration als Zod-Schema (`lib/themes.ts`: Schrift, Farben, Raster-Layout, Cover-Stil, `themeCssVars`); 4 System-Themes (Klassisch, Modern, Romantisch, Dunkel) per Migration 0005 mit festen IDs, Test prüft Code ↔ Migration. `resetDb` legt die System-Themes nach dem Truncate neu an. Schriften vorerst System-Stacks (keine Webfonts)
- [x] Galerie-Ansicht-Komponenten (`src/components/gallery/gallery-view.tsx`: `GalleryView`, `GalleryCover`, `GalleryGrid`), Theme per CSS-Variablen, responsiv per Container-Queries (Vorschau = schmaler Container, kein iframe nötig); Logo-Slot vorhanden
- [ ] Editor `/dashboard/galleries/[id]/design`: Themewahl + Anpassung (Schrift, Farben, Raster, Cover-Stil), Speichern in `galleries.themeId`/Overrides; Live-Vorschau mit Umschalter Desktop/Mobil (iframe oder Container-Breite)
- [x] Logo-Upload pro Account (`lib/branding.ts`, `POST /api/branding/logo`, Speicherung in `accounts.branding.logoKey`, PNG/JPEG/WebP per Magic Bytes, ≤1,5 MB, signierte URL); Anzeige in der Vorschau; E2E erweitert. Hinweis: kein Server-Action-Upload, weil `bodySizeLimit` global wirkt
- [x] Fertig-Kriterium M6 („4 Themes mit Live-Vorschau Desktop und Mobil“) per E2E erfüllt; Logo „in jeder Galerie“ folgt mit der öffentlichen Ansicht (M7)

## Reste aus M5 (niedrige Priorität)

- [ ] Sortierung auch für Videos (Video-Set-Seite), Miniaturen/Cover in der Galerie-Übersicht über signierte Varianten-URLs
- [ ] `/api/test/seed-set` in den Upload-/Video-E2E-Tests durch die echte UI ersetzen und Route entfernen

## Entscheidungsbedarf

D-117: Bunny-Pull-Zone-Token-Key als `BUNNY_STREAM_CDN_TOKEN_KEY` hinterlegen (blockiert nur die Live-Abnahme des Original-Downloads, nicht M5).

## Umgebung (Cloud-Sessions)

- Node 22, pnpm 10, Postgres 16 und Redis 7 als Binaries vorhanden; **kein Docker-Daemon** →
  für Integrationstests `postgres`/`redis-server` direkt starten (Hilfsskript folgt in M1).
- `ui.shadcn.com` ist im Netzwerk gesperrt → shadcn-Komponenten manuell aus dem
  Registry-Quelltext anlegen (siehe D-002).
- SessionStart-Hook (`.claude/hooks/session-start.sh`) installiert Abhängigkeiten.

## Log

### 2026-10-28 – M7 Lightbox
- Lightbox + Fotos/Cover auf `/g/[slug]` verdrahtet. Cloud: Rolle `roses` (superuser) und DBs `roses`, `roses_gallery`, `roses_gallery_test` neu anlegen, falls leer. Nächster Schritt: Video-Reihen (F-VID-01).

### 2026-10-28 – M7 Foto-Raster
- `loadPublicGallery` liefert Fotos/Cover mit signierten Varianten, `GalleryGrid` mit `srcset`/lazy. Nächster Schritt: Lightbox.

### 2026-10-28 – M7 öffentliche Route
- `/g/[slug]`, globale Slugs (Migration 0007), Tests + E2E. Cloud: Postgres per `pg_ctlcluster 16 main start`, Rolle/DBs `roses`, `roses_gallery(_test)` anlegen, `redis-server --daemonize yes`. Nächster Schritt: Foto-Raster mit signierten Varianten.

### 2026-10-28 – M6 abgeschlossen
- Fertig-Kriterium erfüllt, M7 aufgeschlüsselt.

### 2026-10-28 – M6 Logo
- Logo-Upload, Test-Route `/api/test/storage` erkennt Fake-Storage per Duck-Typing (Bundles mit eigenen Klassenkopien). Hinweis E2E lokal: alte `next start`-Prozesse auf Port 3100 beenden, sonst wird ein veralteter Build wiederverwendet. Nächster Schritt: Fertig-Kriterium M6 prüfen, M7 aufschlüsseln.

### 2026-10-28 – M6 Ansicht-Komponenten
- `GalleryView` mit 3 Cover-Stilen und 3 Raster-Layouts, Unit-Tests (SSR-Markup). Nächster Schritt: Editor-Seite `/design`.

### 2026-10-28 – M6 Themes
- `lib/themes.ts`, Migration 0005 (System-Themes), Tests. Nächster Schritt: Ansichts-Komponenten.

### 2026-10-28 – M5 abgeschlossen
- Fertig-Kriterium (Galerie mit Sets anlegen, sortieren, veröffentlichen) per E2E erfüllt. M6 aufgeschlüsselt.

### 2026-10-28 – M5 Sortierung & Cover
- `SortableList` (native DnD + Buttons), Server Actions, Unit-Tests (Reihenfolge, Mandantentrennung, Cover), E2E für Set-Reihenfolge inkl. Reload. Gesamt-E2E lokal 22/22.

### 2026-10-28 – M5 Ablauf-Job
- Migration 0004 (`expiry_reminder_sent_at`), `lib/gallery-expiry.ts`, Job im Worker-Scheduler, Tests gegen Postgres. Neues Ablaufdatum setzt die Erinnerung zurück. D-119 angenommen.

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
