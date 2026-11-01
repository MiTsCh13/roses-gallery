# Projektstatus

> Wird am Ende jeder Session aktualisiert. Neue Sessions lesen zuerst diese Datei
> und `docs/DECISIONS.md`. Log kurz halten (max. 10 Einträge, ältere löschen –
> die Git-Historie bleibt).

**Aktueller Meilenstein:** keiner offen – M11 abgeschlossen (D-147). Phase 2 (alles Priorität S) wartet auf Freigabe durch Mitsch. M10-Rest bei Mitsch: Rechtstexte, Postmark, Stripe-Live
**Stand main:** M0–M3 und M5–M9 abgeschlossen (M2: Abnahme gegen echtes Stripe offen, D-006; M4: Original-URL live offen, D-117)

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
| M9 | Auslieferung & Statistik | ✅ fertig (Postmark live ungeprüft: nur Fake getestet) |
| M10 | Härtung & Launch | ✅ live (Mitsch: Rechtstexte, Postmark, Stripe-Live offen) |
| M11 | Überarbeitung Dashboard & Galerie-Editor | ✅ fertig (Schritte 1–8 + Migration 0015; optionale Reste unten) |

## Optionale Reste aus M11 (niedrige Priorität, nicht Teil des Abschlusses)

- [ ] Wasserzeichen-Standard ins Profil; „Passwort vergessen“ (derzeit = Anmeldelink)
- [ ] Video-Original-Download/-Vorschau in der Bibliothek (D-145)
- [ ] E2E-Test für „Als Titelbild“ im Medienpanel
- [ ] Dashboard-Ansicht der Favoritenlisten je Galerie (CSV)

## Nächste Schritte (M11, erledigt; ein Schritt = ein PR)

Anlass: Rückmeldung von Mitsch nach dem ersten Live-Test (D-140). Reihenfolge so, dass jeder Schritt für sich lauffähig bleibt.

- [x] **1. Optik & Dashboard-Shell:** wärmeres Farbsystem (Rosé/Creme, Display-Schrift für Überschriften), `dashboard/layout.tsx` mit Kopfzeile/Navigation (Galerien, Bibliothek, Profil & Einstellungen, Abmelden), freundlichere Startseite, Login, Galerieliste als Karten. Nur Optik, keine Funktionsänderung
- [x] **2a. Profil & Einstellungen:** `/dashboard/settings` mit Reitern Profil (Studioname, Ansprechpartner, Telefon, Webseite, Instagram in `branding.contact`, Logo), Abo & Speicher (`/settings/billing`), Sicherheit (`/settings/security`); alte Routen `/dashboard/billing` und `/security` entfallen (kein Redirect, Wunsch Mitsch)
- [x] **2b. Passwort (D-141):** `users.password_hash` (Migration 0013), `lib/account-password.ts`, Passwort setzen/ändern im Profil, Login mit E-Mail + Passwort (Session-Zeile + Cookie selbst angelegt, 2FA greift weiter über `requireAccount`, Rate-Limit 10/10 min je E-Mail). Offen daraus: Wasserzeichen-Standard ins Profil (mit Schritt 5/Galerie-Editor), „Passwort vergessen“ = Anmeldelink
- [x] **3. Datenmodell Bibliothek (D-143: additiv):** `folders`, `gallery_media`, `media.folderId`, `media.setId` nullable, Migration 0014 mit Datenübernahme, `lib/library.ts` (+ Test); Uploads in ein Set schreiben zusätzlich `gallery_media`. `sets`/`media.setId` bleiben bis Schritt 7/8 bestehen (öffentliche Ansicht, ZIP, Favoriten, Statistik lesen noch über Sets). Ursprünglich geplant: Tabellen `folders` (verschachtelt) und `gallery_media` (Medium ↔ Galerie, Position); `media.setId` entfällt, `sets` werden migriert und entfernt (Sortierung: Set-Position, dann Medien-Position); Download-Recht nur noch je Galerie (D-142). Upload ohne Galerie möglich. Migration mit Datenübernahme + Test
- [x] **4. Bibliothek `/dashboard/library`** (PR M11-4; Upload ohne Set per `folderId` in `startUpload`/`startVideoUpload`, `lib/library.ts`: `listFolder`/`deleteFolder`/`deleteMedia`, Thumbnails über `/api/library/thumb/[mediaId]`, Video-Kacheln als Platzhalter; Ordner verschieben nicht, Medien-Löschung entfernt auch aus Galerien): Medienraster, Ordner anlegen/umbenennen/löschen, Upload per Drag & Drop (Foto und Video gemischt) in den aktuellen Ordner, Mehrfachauswahl (verschieben, löschen), Wiederholen-Button bei abgebrochenem Upload
- [~] **5. Galerie-Editor zweispaltig** (5a erledigt: zweispaltiges Layout, ausklappbare Blöcke, Slug ausgeblendet (Link „Galerie ansehen“), Wasserzeichen-Block nur bei aktivem Wasserzeichen, Medienpanel rechts mit Bibliothek hinzufügen/entfernen über `gallery_media`; **5b teilweise:** Reihenfolge per Ziehen + Früher/Später-Buttons erledigt (`reorderGalleryMedia`); **5b Design inline erledigt** (Block „Design“ im Editor, Unterseite `/design` entfernt; Vorschau im Block gestapelt); **5b Upload erledigt** (Drag & Drop + Button „Dateien hochladen“ im Medienpanel, Foto+Video, fügt der Galerie direkt hinzu; `lib/video-upload-client.ts` geteilt mit Bibliothek); **5b Vorschau erledigt** (Design-Vorschau im Editor zeigt echte Fotos der Galerie, `lib/design-preview.ts`; Videos als Platzhalter-Kacheln); **offen 5b:** nichts außer Folge-Migration (Mehrfach-Löschen aus der Bibliothek erledigt: Button „endgültig löschen“ im Medienpanel); Sets-Abschnitt bleibt bis Schritt 7/8): links Einstellungen in ausklappbaren Blöcken (Allgemein, Zugang & Ablauf mit Hinweis „kein Datum = kein Ablauf“, Downloads, Wasserzeichen nur sichtbar wenn aktiv, Design inline statt Unterseite), rechts Live-Vorschau der Galerie mit allen Fotos/Videos; Medien per Drag & Drop in die Vorschau hochladen oder aus der Bibliothek hinzufügen; Mehrfachauswahl zum Entfernen/Löschen; Reihenfolge per Ziehen. Slug wird nicht angezeigt (wird weiter automatisch aus dem Titel erzeugt)
- [x] **6. „An Kunden senden“ als Dialog:** Button „An Kunden senden“ im Editor-Kopf öffnet natives `<dialog>` (`components/dialog-button.tsx`) mit dem bisherigen Versandformular + Protokoll; E2E angepasst
- [x] **7. Öffentliche Ansicht ohne Sets:** `loadPublicGallery` liest `gallery_media` (`items`: Fotos + Videos in Galerie-Reihenfolge), ein gemischtes Raster, Video-Kachel öffnet den Player in der Lightbox (`VideoShelf` entfällt), Download-Recht/ZIP/Favoriten/Statistik/Story/Wasserzeichen je Galerie auf `gallery_media`. ZIP ohne Set-Auswahl, Dateinamen `<slug>-<n>`, Foto-Nummern zählen nur Fotos der Galerie. Design-Vorschau mit Platzhalter-Kacheln. Rest: `sets`/`media.setId`/`zip_exports.setId`/Set-Download-Recht noch im Schema (Schritt 8)
- [x] **8. Aufräumen (D-145):** Set-Seite `/dashboard/sets/[setId]`, Sets-Block im Editor, Set-Aktionen, `seed-set`-Route, `PhotoUploader`/`VideoUploader`/`VideoPreview`/`SortableList` entfernt. Titelbild-Auswahl im Medienpanel („Als Titelbild“, ohne eigenen E2E-Test), Galerieliste zählt über `gallery_media`, Cover-Prüfung über `gallery_media`. E2E: Upload (mehrteilig, Fehlertyp, Video) in `library.spec`, Galerie-Flow über Bibliothek. **Folge-Migration erledigt (D-146, Migration 0015).** Offen: Video-Original-Download/-Vorschau im Dashboard (API `/api/videos/{original,playback}` steht noch); 5b-Reste (Design inline, Live-Vorschau, Drag-&-Drop-Upload in die Vorschau, Reihenfolge per Ziehen, Mehrfach-Löschen)

## Nächste Schritte (M4, in dieser Reihenfolge)

- [x] Bunny-Smoke-Test (2026-10-28): Library erreichbar, API-Key gültig
- [x] `VideoProvider` (Bunny + Fake, `VIDEO_TRANSPORT`), `lib/videos.ts` (start → tus-Parameter, Sync, Buchung genau einmal bei `ready`, signierte Embed-URL, Löschen), API `/api/videos/{start,refresh,playback,remove}`, Webhook `/api/bunny/webhook` (Body nicht vertraut, Status wird per API geholt). Gegen echtes Bunny nur Smoke-Test, kein Upload
- [x] Upload-UI für Video-Sets (`VideoUploader`, tus-js-client, Fortschritt, Abbrechen) + Player-Vorschau (signierte Embed-URL erst per Klick) auf `/dashboard/sets/[setId]`; Seite zieht den Status offener Videos selbst nach (webhook-unabhängig). E2E gegen Fake-tus (`/api/test/tus`). Offen: Fortsetzen nach Reload
- [x] Original-Download: signierte CDN-URL (`signOriginalUrl`, Token `base64url(sha256(key+pfad+expires))`), Aktion `/api/videos/original`, Button im Dashboard. **Live ungeprüft:** `BUNNY_STREAM_CDN_HOSTNAME` steht erst im nächsten Lauf in der Umgebung → dann Original-URL des Test-Videos abrufen (Token-Pfad-Format prüfen)
- [ ] Fertig-Kriterium M4: Upload→Encoding, 4K (D-118) und Embed-Token live verifiziert. **Offen nur Original-URL live:** 403 mit dem Embed-Key, vermutlich eigener Pull-Zone-Key → D-117 (Mitsch)
- [x] Limit „Galerie anlegen“ (`assertCanCreateGallery`) mit M5

## Nächste Schritte (M10, in dieser Reihenfolge)

- [x] Lückenliste NFR: `docs/NFR-LUECKEN.md`
- [x] Security-Header inkl. CSP (D-129) in `next.config.ts`, Unit- und E2E-Test
- [x] Sentry (D-130): `lib/error-reporter.ts` (Envelope-API ohne SDK, No-op ohne `SENTRY_DSN`), `instrumentation.ts` (`onRequestError`), Worker (`failed`, `uncaughtException`). Live ungeprüft (DSN fehlt in der Umgebung)
- [x] 2FA für Creator (TOTP, optional, D-131): `/dashboard/security`, Challenge `/login/2fa`, Unit- und E2E-Test
- [x] Rate-Limits: Magic Link 5/h je E-Mail, 20/h je IP (D-132); 2FA, Passwort-Galerie vorhanden. `x-forwarded-for`-Überschreiben gehört in die Deployment-Doku (D-122)
- [x] Barrierefreiheit Galerie-Ansicht (D-133): axe in Playwright + jsdom, Kontrast-Test, „Romantisch“ nachgebessert (Migration 0012). Offen: Kontrastwarnung für eigene Farben im Editor (optional)
- [x] Aufbewahrungsfrist Events 24 Monate, Job `cleanup-events` (D-134); Wasserzeichen-Kopien bewusst nicht aufgeräumt
- [x] Tägliches DB-Backup (D-135): Job `db-backup`, 30 Tage, `docs/BACKUP.md`. Offen: Wiederherstellungsprobe auf echtem Server, `pg_dump` im Worker-Image
- [x] Deployment-Artefakte (D-136): `Dockerfile`, `docker-compose.prod.yml`, `docs/DEPLOYMENT.md`. **Ungeprüft** (kein Docker in der Cloud), Ausrollen braucht Zugang
- [x] Seiten `/impressum`, `/datenschutz`, `/agb` als Platzhalter (Texte in `messages/de.json` → `Legal`, Rechtstexte vom Anwalt), Links auf der Startseite, E2E
- [x] Rechtstexte als Entwurf (D-137), Anbieterdaten per `LEGAL_*`-Umgebung
- [ ] Fertig-Kriterium M10: Produktion auf Hetzner (Mitsch deployt nach `docs/DEPLOYMENT.md`, `LEGAL_*` setzen), Rechtstexte anwaltlich prüfen

## Nächste Schritte (M9, erledigt)

- [x] Event-Erfassung datensparsam (F-DASH-02, D-127): `lib/events.ts`, Tabelle `events` ohne Cookie/IP/Besucher-ID (nur Typ, Galerie, Foto/Video, Zeit); `view` beim Rendern von `/g/[slug]` (nur entsperrt), `play` per Server Action beim Videostart (Rate-Limit), `download` bei erfolgreichem Einzel-Download und ZIP-Link, `favorite` beim Hinzufügen
- [x] Statistik pro Galerie im Dashboard (Galerie-Seite): Aufrufe, Wiedergaben, Downloads, Favoriten für 7/30 Tage. Tests: Unit gegen Postgres. Offen: Zeitreihe/Diagramm, Aufbewahrungsfrist/Aufräumen alter Events (M10)
- [x] Auslieferungs-Mail (F-DASH-03, D-128): `lib/delivery-mail.ts`, Abschnitt „Galerie an Kunden senden“ auf der Galerie-Seite (Empfänger ≤ 20, Betreff/Text mit Platzhaltern `{titel} {link} {passwort_hinweis} {fotograf}`), Text + HTML, Protokoll (`delivery_mails`, Migration 0010), Empfänger werden Kunden-Besucher (Ablauf-Erinnerung). Tests: Unit gegen Postgres + E2E. Offen: Logo im Mail-Kopf (signierte URLs laufen ab, D-128), Vorlage nicht dauerhaft speicherbar
- [x] Fertig-Kriterium M9: Mail kommt an (Fake-Postfach in E2E, Postmark-Format per Unit-Test), Aufrufe werden gezählt (Unit-Test Statistik)
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

D-147: Phase 2 (P2-1 Premiere/Countdown usw.) besteht nur aus Anforderungen mit Priorität S. Freigabe und Reihenfolge durch Mitsch nötig; bis dahin nur optionale M11-Reste.

D-117: Bunny-Pull-Zone-Token-Key als `BUNNY_STREAM_CDN_TOKEN_KEY` hinterlegen (blockiert nur die Live-Abnahme des Original-Downloads, nicht M5).

## Umgebung (Cloud-Sessions)

- Node 22, pnpm 10, Postgres 16 und Redis 7 als Binaries vorhanden; **kein Docker-Daemon** →
  für Integrationstests `postgres`/`redis-server` direkt starten (Hilfsskript folgt in M1).
- `ui.shadcn.com` ist im Netzwerk gesperrt → shadcn-Komponenten manuell aus dem
  Registry-Quelltext anlegen (siehe D-002).
- SessionStart-Hook (`.claude/hooks/session-start.sh`) installiert Abhängigkeiten.

## Log

- 2026-11-01 (Mitsch-Rückmeldungen 2): Upload-Fortschrittsbalken im Editor, „Wird verarbeitet“ statt weißer Kacheln, Galerie im echten Seitenverhältnis (D-150).

- 2026-11-01 (Mitsch-Rückmeldungen): PR #87 Galerie-Ansicht (Video-Favoriten, Filter, Poster, ZIP direkt/Original, Teilen) und Editor-PR (Reihenfolge, ein Speichern, Link kopieren, Live-Vorschau, Mail-Entwurf), D-148/D-149. Cloud: `service postgresql start`, `redis-server --daemonize yes`, Rolle `roses`/DBs, `.env.local` aus `.env.example`. Offen: Video-Poster live prüfen (braucht CDN-Hostname + Token-Key, D-148).

- 2026-11-01 (Routine 4): M11 abgeschlossen (main grün: pnpm check, 329 Tests). Phase 2 nicht begonnen (D-147). Cloud: `service postgresql start`, `redis-server --daemonize yes`, Rolle `roses`/DBs, `.env.local` aus `.env.example`.

- 2026-11-01 (Routine 3): M11 Folge-Migration 0015 (`sets` entfernt, D-146), Tests ohne Sets-Fixtures (`linkAccountMedia`). Nächster Schritt: M11-Fertig-Kriterium gegen UMSETZUNGSPLAN prüfen, Video-Original-Download in die Bibliothek (optional). Cloud: `service postgresql start`, `redis-server --daemonize yes`, Rolle `roses`/DBs, `.env.local` aus `.env.example`.

- 2026-11-01 (Routine 2): M11-5b-5 Design-Vorschau mit echten Galerie-Fotos (Unit + E2E grün). Nächster Schritt: Folge-Migration `sets` entfernen (eigener PR, ~25 Testdateien), danach M11-Fertig-Kriterium prüfen. Cloud: `service postgresql start`, `redis-server --daemonize yes`, Rolle `roses`/DBs, `.env.local` aus `.env.example`.

- 2026-11-01 (Routine): M11-5b-4 Upload per Drag & Drop/Button direkt im Galerie-Editor (Unit + E2E). Nächster Schritt: Live-Vorschau rechts, Folge-Migration `sets` entfernen (eigener PR). Cloud: `service postgresql start`, `redis-server --daemonize yes`, Rolle `roses`/DBs, `.env.local` aus `.env.example`.

- 2026-10-31 (Routine): M11-5b-3 Mehrfach-Löschen aus der Bibliothek im Editor (`deleteGalleryMediaAction`, Bestätigung, Unit-Test). Nächster Schritt: Live-Vorschau + Drag & Drop Upload, Folge-Migration `sets` entfernen (~25 Testdateien betroffen, eigener PR). Cloud: `service postgresql start`, `redis-server --daemonize yes`, Rolle `roses`/DBs, `.env.local` aus `.env.example`.

- 2026-10-31 (Routine): M11-5b-2 Design inline im Editor. Nächster Schritt: Rest 5b (große Live-Vorschau rechts, Drag & Drop Upload, Mehrfach-Löschen Bibliothek), Folge-Migration `sets` entfernen. Cloud: `service postgresql start`, `redis-server --daemonize yes`, Rolle `roses`/DBs, `.env.local` aus `.env.example`.

- 2026-10-31 (Routine): M11-5b-1 Reihenfolge der Galeriemedien per Ziehen/Buttons. Nächster Schritt: Rest 5b (Design inline, Live-Vorschau, Drag & Drop Upload), Folge-Migration `sets` entfernen. Cloud: `service postgresql start`, `redis-server --daemonize yes`, Rolle `roses`/DBs, `.env.local` aus `.env.example`.

- 2026-10-31 (Routine): M11-7 öffentliche Ansicht ohne Sets (#78), M11-8 Aufräumen. Nächster Schritt: 5b und Folge-Migration (sets entfernen), siehe Schritt 8. Cloud: `service postgresql start`, `redis-server --daemonize yes`, Rolle `roses`/DBs, `.env.local` aus `.env.example`.

- `/dashboard/library`: Ordner (anlegen/umbenennen/löschen), Foto+Video-Upload per Drag & Drop in den Ordner, Wiederholen, Mehrfachauswahl (verschieben/löschen), Nav-Eintrag. Unit- und E2E-Test. Nächster Schritt: 5 Galerie-Editor zweispaltig (groß, ggf. in 5a/5b teilen). Cloud: Postgres/Redis neu starten, Rolle `roses`/DBs anlegen.

### 2026-10-31 – M11 Schritt 3 (Datenmodell Bibliothek)
- Additive Migration (D-143), Bibliotheks-Lib mit Mandantentests. Nächster Schritt: 4 Bibliothek-UI. Cloud: Postgres/Redis neu starten, Rolle `roses`/DBs anlegen.

### 2026-10-31 – M11 Schritt 2b (Passwort)
- Optionales Passwort (scrypt) im Profil, Login-Formular „Mit Passwort anmelden“, Unit- und E2E-Test. Nächster Schritt: 3 Datenmodell Bibliothek (große Migration, eigener PR). Cloud: Postgres/Redis neu starten, Rolle `roses`/DBs anlegen.

### 2026-10-31 – M11 Schritt 2a (Profil & Einstellungen)
- Reiter-Bereich unter `/dashboard/settings`, Profil-Lib mit Mandantenschutz-Test, E2E. Nächster Schritt: 2b Passwort, dann 3 Datenmodell Bibliothek. Cloud: Postgres/Redis neu starten, Rolle `roses`/DBs anlegen.

### 2026-10-31 – M11 Schritt 1 (Optik)
- Farbsystem Rosé/Creme, Display-Schrift Fraunces, Dashboard-Layout mit Navigation, Startseite/Login/Galerieliste überarbeitet. Nächster Schritt: M11-2 Profil & Einstellungen. Cloud: Postgres/Redis neu starten, Rolle `roses`/DBs anlegen.

### 2026-10-29 – M10 Rechtstexte
- Impressum/Datenschutz/AGB als Entwurf (D-137, PR folgt im Log). Mitsch: D-117 erledigt (Live-Abnahme Original-URL/HLS beim nächsten Lauf prüfen), kein eigener Backup-Bucket, optionale Reste vorerst nicht. Cloud: Postgres/Redis neu starten (`service postgresql start`, `redis-server --daemonize yes`), Rolle `roses`/DBs `roses_gallery`, `roses_gallery_test` anlegen.

### 2026-10-29 – M10 Abschluss der baubaren Teile
- Barrierefreiheit (PR #60), Event-Aufbewahrung (#61), DB-Backup (#62), Deployment-Artefakte (#63). Alles Baubare in M10 ist erledigt. Offen nur das Fertig-Kriterium (Produktion auf Hetzner, Impressum/Datenschutz online): braucht Coolify-Zugang, Domain, Rechtstexte (D-135, D-136) sowie Live-Abnahmen D-117, D-006. Docker-Build ungeprüft. Cloud: Postgres/Redis neu starten, Rolle `roses`/DBs anlegen.

### 2026-10-29 – M10 Barrierefreiheit
- D-133, axe-Tests, Theme-Kontrast. Nächster Schritt: Aufbewahrung alter Events (D-127), dann Backup/Deployment. Cloud: Postgres/Redis neu starten, Rolle `roses`/DBs anlegen.

### 2026-10-29 – M10 Login-Rate-Limit
- D-132. Nächster Schritt: axe-Test Galerie, dann Backup/Deployment. Cloud: Postgres/Redis neu starten (`service postgresql start`, `redis-server --daemonize yes`), Rolle `roses`/DB `roses_gallery`.

### 2026-10-29 – M10 2FA
- TOTP-2FA (D-131). Nächster Schritt: Login-Rate-Limits/`x-forwarded-for`, axe-Test. Cloud: Postgres/Redis neu starten (`service postgresql start`, `redis-server --daemonize yes`), Rolle `roses`/DB `roses_gallery` anlegen.

### 2026-10-29 – M10 Rechtsseiten
- Platzhalter-Seiten online-bereit. Offen für Launch: echte Texte (Anwalt). Nächster Schritt: 2FA (TOTP, Entscheidung optional vs. Pflicht in DECISIONS), dann Login-Rate-Limits, axe-Test. Cloud: Postgres/Redis neu starten, Rolle/DBs anlegen.
