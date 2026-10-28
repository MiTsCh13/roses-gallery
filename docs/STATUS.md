# Projektstatus

> Wird am Ende jeder Session aktualisiert. Neue Sessions lesen zuerst diese Datei
> und `docs/DECISIONS.md`. Log kurz halten (max. 10 Einträge, ältere löschen –
> die Git-Historie bleibt).

**Aktueller Meilenstein:** M9 – Auslieferung & Statistik (Rest aus M4/M7: Live-Abnahme HLS/Original-URL, D-117)
**Stand main:** M0–M3 und M5–M8 abgeschlossen (M2: Abnahme gegen echtes Stripe offen, D-006; M4: Original-URL live offen, D-117)

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
| M7 | Galerie-Ansicht & Player | ✅ fertig bis auf Live-Abnahme HLS/Original (D-117) |
| M8 | Zugriff, Downloads, Favoriten | ✅ fertig (Dashboard-Ansicht der Favoriten optional, nicht Teil des Kriteriums) |
| M9 | Auslieferung & Statistik | in Arbeit |
| M10 | Härtung & Launch | offen |

## Nächste Schritte (M4, in dieser Reihenfolge)

- [x] Bunny-Smoke-Test (2026-10-28): Library erreichbar, API-Key gültig
- [x] `VideoProvider` (Bunny + Fake, `VIDEO_TRANSPORT`), `lib/videos.ts` (start → tus-Parameter, Sync, Buchung genau einmal bei `ready`, signierte Embed-URL, Löschen), API `/api/videos/{start,refresh,playback,remove}`, Webhook `/api/bunny/webhook` (Body nicht vertraut, Status wird per API geholt). Gegen echtes Bunny nur Smoke-Test, kein Upload
- [x] Upload-UI für Video-Sets (`VideoUploader`, tus-js-client, Fortschritt, Abbrechen) + Player-Vorschau (signierte Embed-URL erst per Klick) auf `/dashboard/sets/[setId]`; Seite zieht den Status offener Videos selbst nach (webhook-unabhängig). E2E gegen Fake-tus (`/api/test/tus`). Offen: Fortsetzen nach Reload
- [x] Original-Download: signierte CDN-URL (`signOriginalUrl`, Token `base64url(sha256(key+pfad+expires))`), Aktion `/api/videos/original`, Button im Dashboard. **Live ungeprüft:** `BUNNY_STREAM_CDN_HOSTNAME` steht erst im nächsten Lauf in der Umgebung → dann Original-URL des Test-Videos abrufen (Token-Pfad-Format prüfen)
- [ ] Fertig-Kriterium M4: Upload→Encoding, 4K (D-118) und Embed-Token live verifiziert. **Offen nur Original-URL live:** 403 mit dem Embed-Key, vermutlich eigener Pull-Zone-Key → D-117 (Mitsch)
- [x] Limit „Galerie anlegen“ (`assertCanCreateGallery`) mit M5

## Nächste Schritte (M9, in dieser Reihenfolge)

- [x] Event-Erfassung datensparsam (F-DASH-02, D-127): `lib/events.ts`, Tabelle `events` ohne Cookie/IP/Besucher-ID (nur Typ, Galerie, Foto/Video, Zeit); `view` beim Rendern von `/g/[slug]` (nur entsperrt), `play` per Server Action beim Videostart (Rate-Limit), `download` bei erfolgreichem Einzel-Download und ZIP-Link, `favorite` beim Hinzufügen
- [x] Statistik pro Galerie im Dashboard (Galerie-Seite): Aufrufe, Wiedergaben, Downloads, Favoriten für 7/30 Tage. Tests: Unit gegen Postgres. Offen: Zeitreihe/Diagramm, Aufbewahrungsfrist/Aufräumen alter Events (M10)
- [ ] Auslieferungs-Mail (F-DASH-03): Postmark, anpassbarer Text (Platzhalter Titel/Link/Passwort-Hinweis), Creator-Logo/Branding, Empfänger-Liste, Versand aus dem Dashboard, Protokoll
- [ ] Fertig-Kriterium M9: Auslieferungs-Mail kommt an, Aufrufe werden gezählt
- [ ] Optional aus M8: Dashboard-Ansicht der Favoritenlisten je Galerie (CSV)

## Nächste Schritte (M8, erledigt)

- [x] Passwortschutz pro Galerie (F-SEC-01, D-122): `lib/gallery-access.ts` (scrypt-Hash, signiertes Zugangs-Cookie je Galerie, 7 Tage, ungültig nach Passwortwechsel), Redis-Rate-Limit (`lib/rate-limit.ts`, 5 Versuche/10 min je Besucher, 60/h je Galerie), Passwort-Formular auf `/g/[slug]` (gesperrte Galerie liefert nur Titel), Passwort setzen/entfernen im Dashboard. Tests: Unit (Postgres, Redis) + E2E
- [x] Download-Rechte je Galerie und Set (F-SEC-02): `lib/download-policy.ts` (none/web/original, Set überschreibt Galerie), Auswahl im Dashboard (Galerie-Formular, Set-Seite), `GET /api/g/[slug]/download/[mediaId]?size=` → 302 auf signierte URL (60 s, `Content-Disposition`), gleiche Sichtbarkeitsregeln wie die Galerie (Passwort, Ablauf), Download-Links in der Lightbox. Offen/klein: Original-Download hat keine Dateiendung (Medien speichern keinen Dateinamen/Content-Type) – bei Bedarf Spalte ergänzen
- [x] ZIP-Download als Worker-Job (F-SEC-02, D-123): Besucher gibt E-Mail an (`/g/[slug]`, Server Action, Rate-Limit 5/h), Job `build-zip` packt Fotos (`lib/zip-writer.ts`, Store-only, ohne Fremdpaket) nach `<account>/zips/<id>.zip` und mailt `/api/g/[slug]/zip/[id]` (302 auf signierte URL, 7 Tage gültig); Job `cleanup-zip-exports` stündlich. Tests: Unit gegen Postgres + unzip-Prüfung, kein E2E (Formular erscheint erst mit fertigen Fotos, Worker läuft in E2E nicht). Offen: ZIP nur Fotos (keine Videos), in-memory ≤ 1,5 GB (kein Streaming/ZIP64), `AUTH_URL` muss im Worker gesetzt sein (sonst `http://localhost:3000` im Link)
- [x] Wasserzeichen auf Web-Größen (F-SEC-03, D-124): Logo des Accounts, Position/Deckkraft/Größe im Dashboard (Galerie-Seite), Schalter je Galerie (`galleries.watermarkEnabled`, Migration 0009). `lib/watermark.ts` stempelt lazy und cacht die Kopie im Storage (Schlüssel enthält Settings-Signatur); `/api/g/[slug]/img/[mediaId]?w=` (302 auf signierte URL) bedient Raster/Lightbox/Cover, Web-Download und Web-ZIP nutzen die gestempelte Kopie, Originale nie. Tests: Unit gegen Postgres (Pixelprüfung, Cache, Downloads, ZIP). Offen: alte Stempelkopien bleiben bei Einstellungswechsel im Storage (nicht gebucht, kein Cleanup); kein Plan-Gate (D-109: Bud+); Free-Plan ungeprüft
- [x] Favoriten (F-INT-01, D-125): `lib/favorites.ts` (Besucher per HMAC-signiertem Cookie-Token, Gast wird beim ersten Herz angelegt; mehrere Listen ≤ 20, ≤ 2000 Fotos je Liste), Herz im Raster und in der Lightbox, Panel mit Listen, „Liste an den Fotografen senden“ (Mail an Owner: Set + Foto-Nummern) und E-Mail-Magic-Link (`/g/[slug]/v/[token]`, setzt Cookie → gleiche Listen auf anderem Gerät). Rate-Limits (Toggle 600/h, Senden 5/h, Link 5/h). Tests: Unit gegen Postgres + jsdom-Komponententest; kein E2E mit Fotos (Worker fehlt in E2E). Offen: Dashboard-Ansicht der Favoriten je Galerie/CSV (nächster Schritt), Videos nicht favorisierbar
- [x] Teilen (F-INT-02, D-126): „Galerie-Link teilen“ (Web Share API, Fallback Zwischenablage), Story-Bild 1080×1920 (`lib/story-image.ts`, `GET /api/g/[slug]/story/[mediaId]`: Foto auf unscharfer Kopie + Titel, nutzt Wasserzeichen-Kopie, nur bei erlaubtem Web-Download, Rate-Limit 60/h) mit „Als Story teilen“ in der Lightbox (Share-Sheet mit Datei, sonst Download). Direkter Instagram-Share nur über das Share-Sheet des Geräts (kein SDK). Tests: Unit + jsdom
- [x] Fertig-Kriterium M8: Passwort, ZIP-Download, Wasserzeichen, Favoritenlisten – erfüllt (Unit-/Komponententests, E2E 28/28; echte Abnahme mit Fotos/R2 hängt an D-117)

## Nächste Schritte (M7, erledigt)

- [x] Öffentliche Route `/g/[slug]` (`lib/public-gallery.ts`, `noindex`): nur `published` und nicht abgelaufen, sonst `notFound`; Theme/Overrides + Logo über `GalleryView`; Slugs global eindeutig (Migration 0007 benennt Dubletten um, `freeSlug` global, Retry bei Race). Hinweis: `notFound` kommt im gestreamten Suspense-Shell, daher HTTP 200 mit Not-Found-Inhalt (E2E prüft Inhalt). Cover/Fotos folgen im nächsten Schritt
- [x] Foto-Sets: Raster mit echten Fotos (signierte Varianten 1 h, `srcset` 400/1200/2400, lazy loading), Cover aus `coverMediaId` (größte Variante); nur `ready`-Fotos. Kein E2E mit echten Bildern (Worker läuft in E2E nicht) – Unit-Tests gegen Postgres + Komponententest
- [x] Lightbox (`lightbox.tsx`, `gallery-grid.tsx` jetzt Client-Komponente): Klick öffnet, Pfeiltasten/Buttons/Wischen, Esc, Fokus + Scroll-Sperre; `/g/[slug]` reicht Fotos und Cover jetzt tatsächlich durch (zuvor `tiles: []`). Tests als jsdom-Komponententests; kein E2E mit echten Bildern (Worker läuft in E2E nicht)
- [x] Video-Reihen im Netflix-Stil (`video-shelf.tsx`: Hero-Player + Reihe je Video-Set, signierte Embed-URL 4 h, iframe erst nach Klick), Hybrid-Galerie (Video- und Foto-Sets gemeinsam). Nur `ready`-Videos; Titel „Film n“ (Medien haben keinen Titel), keine Poster/Thumbnails (Provider liefert noch keine). Kein E2E mit echtem Video-Set (Worker/Bunny-Fake) – Unit- und Komponententests
- [x] HLS-Player (`hls-player.tsx`, hls.js, nativer HLS-Fallback für Safari inkl. `x-webkit-airplay`): Qualitätswahl, Vollbild (native Controls), Fortsetzen (`resume-position.ts`, localStorage). Provider `signHlsUrl` (Bunny: verzeichnisweiter CDN-Token `token_path`) liefert nur mit `BUNNY_STREAM_CDN_TOKEN_KEY` eine URL, sonst bleibt das Embed-iframe. **Live ungeprüft** (D-117: Token-Format/Segmente, ggf. CORS der Pull-Zone). Tests: Unit + jsdom, kein E2E mit echtem HLS
- [x] AirPlay/Chromecast (`cast.ts`, Button im `HlsPlayer`): Remote Playback API, Fallback WebKit-Picker, Button nur bei Feature-Detection (D-121, kein Cast SDK). Tests: Unit + jsdom; echte Geräte ungeprüft
- [x] Performance: `scripts/lighthouse-lcp.sh` (60 Fotos im Fake-Storage, Produktions-Build, Lighthouse mobil/Slow-4G): LCP erst 3,1 s (Cover lud immer die 2400-px-Variante), mit Cover-`srcset` + `fetchpriority=high` 0,9 s, CLS 0, TBT 82 ms. Einschränkung: lokaler Server, Fake-Storage statt R2/CDN
- [ ] Fertig-Kriterium M7 abschließend prüfen (Abnahme live gegen R2/Bunny hängt an D-117)

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

### 2026-10-28 – M9 Statistik
- Events + Dashboard-Statistik (D-127). Nächster Schritt: Auslieferungs-Mail (F-DASH-03). Cloud: Postgres/Redis neu starten, Rolle/DBs anlegen.

### 2026-10-28 – M8 Teilen, M8 fertig
- Link-/Story-Teilen (D-126), M8-Kriterium erfüllt, M9 aufgeschlüsselt. Nächster Schritt: Event-Erfassung. Cloud: Postgres/Redis neu starten, Rolle/DBs anlegen.

### 2026-10-28 – M8 Favoriten
- F-INT-01 fertig (D-125). Nächster Schritt: Dashboard-Ansicht der Favoriten, dann Teilen/Instagram-Story (F-INT-02). Cloud: Postgres/Redis neu starten, Rolle/DBs anlegen.

### 2026-10-28 – M8 Wasserzeichen
- F-SEC-03 fertig (D-124). Cloud: Postgres/Redis neu starten, Rolle/DBs anlegen. Nächster Schritt: Favoriten (mehrere Listen ohne Konto, Magic Link, Export), dann Teilen/Instagram-Story.

### 2026-10-28 – M8 ZIP-Download
- ZIP per Mail fertig (D-123). Cloud: Postgres/Redis neu starten, Rolle `roses` + DBs anlegen. Nächster Schritt: Wasserzeichen auf Web-Größen (F-SEC-03), dann Favoriten.

### 2026-10-28 – M8 Download-Rechte
- Einzel-Download + Rechte fertig. Cloud: nach Resume Postgres/Redis neu starten (`pg_ctlcluster 16 main start`, `redis-server --daemonize yes`). Nächster Schritt: ZIP-Download als Worker-Job mit Mail-Link.

### 2026-10-28 – M8 Passwortschutz
- F-SEC-01 fertig (siehe M8-Liste, D-122). Cloud: Postgres/Redis neu starten und Rolle/DBs anlegen wie unten. Nächster Schritt: Download-Rechte je Galerie/Set (F-SEC-02).

### 2026-10-28 – M7 LCP
- Lighthouse-Skript + Cover-`srcset`, LCP 3,1 s → 0,9 s. M7 damit funktional fertig. Nächster Schritt: M8 in `UMSETZUNGSPLAN.md` aufschlüsseln. Cloud: Postgres `pg_ctlcluster 16 main start`, Rolle/DBs neu anlegen, `redis-server --daemonize yes`; Lighthouse per `npm i lighthouse` außerhalb des Repos.

### 2026-10-28 – M7 Cast
- Cast-Button via Remote Playback API (D-121). Nächster Schritt: Lighthouse-LCP (<2,5 s) prüfen = letztes M7-Kriterium; Chromium ist vorinstalliert. Cloud: Rolle/DBs wie oben neu anlegen.

### 2026-10-28 – M7 HLS-Player
- `HlsPlayer` + `signHlsUrl`, Fallback Embed ohne CDN-Key. Nächster Schritt: AirPlay/Chromecast (Cast SDK, Feature-Detection), dann Lighthouse-LCP. Live-Prüfung HLS hängt an D-117.

### 2026-10-28 – M7 Video-Reihen
- `loadPublicGallery` liefert signierte Video-URLs, `VideoShelf` + Hybrid-Ansicht, Tests. Cloud: Rolle `roses` + DBs wieder anlegen (siehe oben). Nächster Schritt: HLS-Player (hls.js) mit Qualitätswahl/Fortsetzen; Thumbnails für Videos klären.

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

