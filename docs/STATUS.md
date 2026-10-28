# Projektstatus

> Wird am Ende jeder Session aktualisiert. Neue Sessions lesen zuerst diese Datei
> und `docs/DECISIONS.md`. Log kurz halten (max. 10 Einträge, ältere löschen –
> die Git-Historie bleibt).

**Aktueller Meilenstein:** M6 – Design-Editor (M4-Rest: nur Live-Abnahme Original-URL, D-117)
**Stand main:** M0–M3 und M5 abgeschlossen (M2: Abnahme gegen echtes Stripe offen, D-006; M4: Original-URL live offen, D-117)

## Meilensteine

| # | Meilenstein | Status |
| --- | --- | --- |
| M0 | Projekt-Setup | ✅ fertig |
| M1 | Datenmodell & Login | ✅ fertig |
| M2 | Abo & Planlimits | ✅ fertig (Stripe nur gegen Fake getestet) |
| M3 | Foto-Upload & Verarbeitung | ✅ fertig (Limit „Galerie anlegen“ folgt mit M5) |
| M4 | Video über Bunny Stream | ✅ fertig bis auf Live-Abnahme Original-URL (D-117) |
| M5 | Galerie-Verwaltung | ✅ fertig (Reste unten) |
| M6 | Design-Editor | 🚧 offen, aufgeschlüsselt |
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

## Nächste Schritte (M6, in dieser Reihenfolge)

- [x] Theme-Konfiguration als Zod-Schema (`lib/themes.ts`: Schrift, Farben, Raster-Layout, Cover-Stil, `themeCssVars`); 4 System-Themes (Klassisch, Modern, Romantisch, Dunkel) per Migration 0005 mit festen IDs, Test prüft Code ↔ Migration. `resetDb` legt die System-Themes nach dem Truncate neu an. Schriften vorerst System-Stacks (keine Webfonts)
- [ ] Galerie-Ansicht-Komponenten (`GalleryView`, Cover, Raster), die ein Theme per CSS-Variablen anwenden – dieselben Komponenten für Vorschau und echte Ansicht (M7)
- [ ] Editor `/dashboard/galleries/[id]/design`: Themewahl + Anpassung (Schrift, Farben, Raster, Cover-Stil), Speichern in `galleries.themeId`/Overrides; Live-Vorschau mit Umschalter Desktop/Mobil (iframe oder Container-Breite)
- [ ] Logo-Upload pro Account (R2, signierte URL), Anzeige in der Vorschau/jeder Galerie; E2E: Theme wechseln → Vorschau ändert sich, Logo sichtbar
- [ ] Fertig-Kriterium M6 prüfen (UMSETZUNGSPLAN)

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
