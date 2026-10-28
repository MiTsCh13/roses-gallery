# Entscheidungen

> Offene Punkte werden hier gesammelt, jeweils mit der Annahme, mit der vorerst
> weitergearbeitet wird. Der Mensch entscheidet, wann er will – die Entwicklung
> wartet nicht darauf. Erledigte Punkte wandern nach unten.

## Offen – Mensch gefragt

| ID | Frage | Vorläufige Annahme | Benötigt bis |
| --- | --- | --- | --- |
| D-117 | Original-Download liefert live 403 (auch signierte `playlist.m3u8`). Vermutung: Der Pull-Zone-Token-Key der Library (Bunny → Library → Delivery/Security → Pull-Zone *Token Authentication Key*) ist ein anderer als der Embed-Key `BUNNY_STREAM_TOKEN_KEY`. Bitte als `BUNNY_STREAM_CDN_TOKEN_KEY` hinterlegen (ohne ihn wird der Embed-Key genutzt) | Code liest den Key bereits; Original-Download bleibt bis dahin ungeprüft | M4-Abnahme |

Schlüssel bitte als Secrets in der Cloud-Umgebung (bzw. GitHub Actions Secrets) hinterlegen, nie ins Repo. Anleitung und Variablenliste: `docs/ZUGAENGE.md`.

## Getroffen

| ID | Entscheidung | Begründung | Datum |
| --- | --- | --- | --- |
| – | Keine offenen Fragen | – | – |
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
| D-001 | Plan-Namen und Preise: **Bud** 10 €/Monat (50 GB), **Bloom** 20 € (250 GB), **Bouquet** 50 € (1 TB), **Enterprise** auf Anfrage (Standardquote 5 TB, Vertragswert pro Konto). Jahrespreis −20 % (96 / 192 / 480 €). Free bleibt (2 GB, 3 Galerien) | Vorgabe Mitsch; Namen passen zu „Roses“ | 2026-10-27 |
| D-109 | Feature-Zuschnitt (Annahme): Bud = Basis (unbegrenzte Galerien, 4K, Passwort, Wasserzeichen, Favoriten …); Bloom + Video-Cover, Branding & Socials, Trinkgeld, Premiere; Bouquet und Enterprise = alle Features inkl. Find my Face, White-Label, externe Download-Links, Video-Kapitel. Enterprise wird manuell am Account gesetzt (`plan=enterprise`, Status `active`), nicht über Checkout | Mitsch: „entscheide selbst und dokumentiere“; Speicherstaffel angepasst | 2026-10-27 |
| D-004 | Branch-Schutz für `main` aktiv (PR + Statuschecks Pflicht) | von Mitsch eingerichtet | 2026-10-27 |
| D-105–D-108 | Von Mitsch bestätigt (siehe oben) | – | 2026-10-27 |
| D-002 | `ui.shadcn.com` bleibt gesperrt; shadcn-Komponenten werden manuell aus dem Registry-Quelltext angelegt | Kein Freigabebedarf, nur etwas Mehraufwand | 2026-10-27 |
| D-005–D-007 | Zugänge (Postmark, Google-OAuth, Stripe-Testschlüssel, R2, Bunny Stream) liegen in den Umgebungsvariablen. Offen: `STRIPE_WEBHOOK_SECRET` (kommt erst mit öffentlicher Webhook-URL). **Smoke-Test 2026-10-27:** R2 vollständig grün (put/get, Multipart mit signierter Part-URL inkl. ETag, signGet, head, delete). Stripe, Postmark und Bunny nicht erreichbar: Proxy der Cloud-Umgebung blockt `api.stripe.com`, `api.postmarkapp.com`, `video.bunnycdn.com` (CONNECT 403) → siehe D-110. Google-Login nicht automatisierbar | Bestätigt von Mitsch | 2026-10-27 |
| D-112 | Upload-UI mit eigenem, kleinem Uploader statt Uppy | Uppy 6 `aws-s3` nutzt s3mini/`signRequest` statt klassischer Multipart-Callbacks und passt nicht zur bestehenden API (`start/sign/complete/abort`); eigener Code ist kleiner und voll getestet | 2026-10-27 |
| D-110 | Netzwerk-Allowlist um Stripe, Postmark, Bunny erweitert. Smoke-Test 2026-10-27: Stripe (Testmodus, Checkout-Session) und Postmark (Server-Abfrage, keine Mail gesendet) grün; Bunny scheitert an D-111. Webhook-Secret und Google-Login weiter ungetestet. R2-Bucket braucht CORS mit `ExposeHeaders: ETag` (aus der Cloud nicht prüfbar) | Von Mitsch umgesetzt | 2026-10-27 |
| D-111 | Bunny-Library-ID von Mitsch in der Umgebung ergänzt (gilt ab dem nächsten Lauf); Bunny-Smoke-Test folgt zum Start von M4 | Vorgabe Mitsch | 2026-10-28 |
| D-113 | R2-Lifecycle-Regel für unvollständige Multipart-Uploads von Mitsch auf 3 Tage gesetzt; der Cleanup-Job (`cleanup-stale-uploads`) entfernt die zugehörigen DB-Zeilen nach 24 h | Vorgabe Mitsch | 2026-10-28 |
| D-114 | Bunny-Webhook ist unsigniert → Body dient nur zur Identifikation, der Status wird per authentifizierter API abgefragt. Wiedergabe über Bunny-Embed mit Token (`sha256(tokenKey+videoId+expires)`); HLS-Eigenplayer folgt in M7. Gebucht wird die beim Start angekündigte Größe (tus erzwingt sie) | Sicherheit ohne Webhook-Signatur | 2026-10-28 |
| D-116 | Bunny-Smoke-Test 2026-10-28 gegen echtes Bunny: Video anlegen → tus-Upload (Signatur korrekt) → Transkodierung bis `ready` mit Dauer/Auflösung → Status-Mapping stimmt. Embed-Token-URL ungeprüft (Host gesperrt) | – | 2026-10-28 |
| D-118 | 4K-Test 2026-10-28 gegen echtes Bunny: 3840×2160-H.264 (13 MB) → tus → `ready` in unter 30 s mit korrekten Maßen; Embed-Token 200; Smoke-Video gelöscht | – | 2026-10-28 |
| D-119 | Ablauf-Erinnerung (F-GAL-04): eine Mail 7 Tage vor Ablauf an die Kunden-Besucher (`role=client`) der Galerie und an die Account-Owner; Versand täglich 07:00 UTC; neues Ablaufdatum löst die Erinnerung erneut aus. Annahme, da Kunden-E-Mails erst mit M8 erfasst werden – bis dahin erreicht sie faktisch die Owner. Einwand bitte bei Bedarf | Spec nennt „Kunden“, Owner als Rückfallebene | 2026-10-28 |
| D-120 | Öffentliche URL `/g/[slug]`: Slugs werden global eindeutig (heute nur pro Account). Annahme für M7: Migration auf globalen Unique-Index, `freeSlug` prüft global; Kollision beim Anlegen → Suffix. Einwand bitte vor M7-Schritt 1, Alternative wäre `/g/[account]/[slug]` mit Account-Kürzel | Spec nennt keine Account-Kennung in der URL; kürzere Kunden-Links | 2026-10-28 |
| D-115 | Bunny: Keep Original Files aktiv, `BUNNY_STREAM_CDN_HOSTNAME` und `iframe.mediadelivery.net` ergänzt, Smoke-Video gelöscht. Embed-Token live geprüft (200). Original-URL-Signatur nach Bunny-Doku, live erst mit Hostname im nächsten Lauf prüfbar | Von Mitsch umgesetzt | 2026-10-28 |
| D-121 | Casting ohne Google Cast SDK: Remote Playback API (`video.remote.prompt()`, deckt Chromecast in Chrome/Edge und AirPlay in Safari ab), Fallback `webkitShowPlaybackTargetPicker`; Button nur bei Feature-Detection | Kein Fremdskript in der Kundengalerie (Datenschutz DACH), weniger Code. Einschränkung: hls.js/MSE-Streams werden von Chrome ggf. nur als Tab-Cast unterstützt; Einwand bitte bei Bedarf | 2026-10-28 |
