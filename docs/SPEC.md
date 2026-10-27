# Software-Spezifikation: Roses Gallery

Stand: 11.10.2026 · Autor: Mitsch

## Überblick

Ziel ist eine SaaS-Plattform, über die Hochzeitsfotografen und -videografen fertige Foto- und Video-Galerien gebrandet an ihre Kunden ausliefern. Vorbild ist [Gallerio](https://gallerio.co/), das sich als vollständiger Auslieferungs-Workflow statt bloßer Speicherlösung positioniert: Upload, gestaltete Galerie, Streaming, Verkauf, Trinkgeld und Bewertungen an einem Ort.

**Kernversprechen:** Video steht gleichrangig neben Foto ("Hybrid-Galerien"): Videos ohne Längenlimit, 4K ohne erzwungene Kompression, unbegrenzte Re-Uploads und TV-Streaming über AirPlay und Chromecast.

**Differenzierung gegenüber Google Drive, Dropbox, Pixieset & Co.:**

- Netflix-artige Video-Ansicht mit Covern und Kapiteln
- Premiere-Bildschirm mit Countdown vor der Freischaltung
- "Find my Face": Gäste finden per Selfie alle Fotos von sich (Phase 3)
- White-Label auf eigener Subdomain
- Monetarisierung direkt in der Galerie (Produkte, Trinkgeld, Bewertungen)
- Persönlicher Support durch Menschen statt Bots

**Ziel:** Roses Gallery, ein funktionsgleiches Produkt für den DACH-Raum: deutschsprachig, Preise in EUR, DSGVO-konform mit EU-Hosting. Shop-Verkäufe und Trinkgeld laufen ohne Plattform-Provision (0 %).

## Rollen & Personas

Das System kennt vier Rollen; nur Creator und Admin haben ein Konto.

| Rolle | Wer | Konto | Darf |
| --- | --- | --- | --- |
| Creator | Fotograf, Videograf, Studio (Abo-Kunde) | ja | Galerien anlegen, gestalten, ausliefern, verkaufen, Statistiken sehen |
| Kunde | Brautpaar, Auftraggeber | optional (E-Mail-Magic-Link) | Galerie ansehen, Favoriten, Download, kaufen, Trinkgeld, Bewertung |
| Gast | Hochzeitsgäste mit Link | nein | ansehen, ggf. Download, kaufen (Find my Face ab Phase 3) |
| Admin | Betreiber-Team | ja | Nutzer, Abos, Support, Speicher, Missbrauchsmeldungen |

**Primäre Persona:** Hybrid-Videograf, 30–40 Hochzeiten pro Jahr, liefert Highlight-Film, Langfassung und 500–800 Fotos. Schmerzpunkt heute: Drive- oder Dropbox-Links wirken lieblos, Vimeo kostet extra, Videos werden komprimiert.

## Funktionale Anforderungen

Die Anforderungen sind in zwölf Module gegliedert; IDs (z. B. F-UP-01) dienen als Referenz für Tickets. Priorität: **M** = MVP, **S** = Phase 2, **C** = Phase 3.

### 1. Konto & Abo (F-ACC)

- F-ACC-01 (M): Registrierung per E-Mail (Magic Link) und Google-Login, E-Mail-Verifizierung.
- F-ACC-02 (M): Kostenlose Testphase, danach Plan-Wahl monatlich oder jährlich (Jahr ca. 20 % günstiger).
- F-ACC-03 (M): Planlimits technisch erzwingen: Speicher-Kontingent und Feature-Flags je Plan.
- F-ACC-04 (M): Up- und Downgrade, Kündigung, Rechnungen über Stripe Customer Portal.
- F-ACC-05 (S): Team-Mitglieder pro Studio-Konto.

### 2. Upload & Medienverarbeitung (F-UP)

- F-UP-01 (M): Bulk-Upload von Fotos (JPG, PNG, HEIC, optional RAW nur als Download) und Videos (MP4, MOV) per Drag & Drop, fortsetzbar bei Abbruch.
- F-UP-02 (M): Direkt-Upload in Object Storage über signierte Multipart-URLs, ohne Umweg über den App-Server.
- F-UP-03 (M): Fotos: Thumbnails und Web-Größen (400, 1200, 2400 px) plus Original. EXIF-Datum zur Sortierung.
- F-UP-04 (M): Videos: Transkodierung in HLS mit Adaptive Bitrate bis 4K (über Bunny Stream), Original bleibt für Download erhalten. Keine Längenbegrenzung.
- F-UP-05 (M): Ersetzen einer Datei (Revision) behält URL, Favoriten und Reihenfolge; Revisionen sind unbegrenzt.
- F-UP-06 (S): Externe Download-Links (z. B. Dropbox, WeTransfer) statt eigenem Speicher für große Rohdaten.
- F-UP-07 (C): Lightroom-Plugin für Direkt-Export.

### 3. Galerie-Struktur (F-GAL)

- F-GAL-01 (M): Galerie mit Titel, Datum, Cover, Slug und Status (Entwurf, veröffentlicht, abgelaufen, archiviert).
- F-GAL-02 (M): Sets (z. B. Getting Ready, Trauung, Party) mit freier Reihenfolge; Medien per Drag & Drop sortierbar.
- F-GAL-03 (M): Hybrid-Galerie: Video-Sets und Foto-Sets in einer Galerie.
- F-GAL-04 (M): Ablaufdatum mit automatischer Erinnerung an Kunden vor Ablauf.
- F-GAL-05 (S): Galerie duplizieren und als Vorlage speichern.

### 4. Galerie-Editor & Design (F-DES)

- F-DES-01 (M): Themes (mind. 4) mit Wahl von Schrift, Farben, Raster-Layout und Cover-Stil.
- F-DES-02 (M): Live-Vorschau Desktop und Mobil im Editor.
- F-DES-03 (M): Logo des Creators in jeder Galerie.
- F-DES-04 (S): Branding & Socials: Kontaktdaten, Website und Social-Links im Galerie-Footer.
- F-DES-05 (S): Galerie-Musik: Hintergrundmusik aus lizenzfreier Bibliothek oder eigener Upload.
- F-DES-06 (S): Video-Cover: kurzer Loop statt Standbild als Galerie-Cover.

### 5. Video-Erlebnis (F-VID)

- F-VID-01 (M): Netflix-artige Ansicht: großes Hero-Video, darunter Reihen mit Filmen (Highlight, Trauung, Reden).
- F-VID-02 (M): Adaptiver HLS-Player mit Qualitätswahl, Vollbild, Fortsetzen an letzter Position.
- F-VID-03 (M): TV-Streaming über AirPlay und Chromecast.
- F-VID-04 (S): Video-Kapitel mit Sprungmarken (z. B. Einzug, Ringtausch, Erster Tanz).
- F-VID-05 (S): Einbetten einzelner Videos auf der Creator-Website per iFrame (Ersatz für Vimeo/YouTube).

### 6. Zugriff & Schutz (F-SEC)

- F-SEC-01 (M): Galerie-Link öffentlich-unlisted oder mit Passwort.
- F-SEC-02 (M): Download-Rechte je Galerie und Set: aus, nur Web-Größe, Original; Einzel- oder ZIP-Download.
- F-SEC-03 (M): Wasserzeichen (Logo, Position, Deckkraft) auf Web-Größen, Original unberührt.
- F-SEC-04 (S): Getrennte PINs für Kunde und Gäste.

### 7. Kunden-Interaktion (F-INT)

- F-INT-01 (M): Favoriten mit mehreren Listen (z. B. Album-Auswahl), Export der Liste an den Creator.
- F-INT-02 (M): Teilen per Link und Direkt-Share auf Instagram (Story-Format).
- F-INT-03 (S): Bewertungen anfordern: Sterne + Text, optional Weiterleitung zu Google-Bewertung.

### 8. Premiere (F-PRE)

- F-PRE-01 (S): Premiere-Bildschirm mit Cover, Titel und Countdown; Galerie schaltet sich zum Zeitpunkt automatisch frei.
- F-PRE-02 (S): Erinnerungs-Mail an Kunden und Gäste zum Start.

### 9. Find my Face (F-FACE) – Phase 3

- F-FACE-01 (C): Gast lädt ein Selfie hoch und sieht alle Fotos, auf denen sein Gesicht erkannt wurde.
- F-FACE-02 (C): Pro Galerie aktivierbar; Creator bestätigt vorher die Rechtsgrundlage. Vor der Umsetzung mit Datenschutz-Anwalt prüfen.
- F-FACE-03 (C): Selfie wird nach dem Abgleich gelöscht, Gesichtsvektoren mit Galerie-Ablauf.

### 10. Verkauf & Trinkgeld (F-SALE)

- F-SALE-01 (S): Shop pro Galerie: digitale Downloads und Pakete. Physische Prints vorerst nicht (kein Druck-Partner).
- F-SALE-02 (S): Bezahlung über Stripe Connect direkt an den Creator; keine Plattform-Provision, nur die Stripe-Gebühren.
- F-SALE-03 (S): Trinkgeld-Button mit Beträgen und Dankesnachricht.

### 11. White-Label (F-WL)

- F-WL-01 (S): Eigene Subdomain (z. B. galerie.studio-xy.at) mit automatischem TLS-Zertifikat.
- F-WL-02 (S): Keine Plattform-Hinweise in Galerie, Mails und Player.

### 12. Dashboard & Benachrichtigungen (F-DASH)

- F-DASH-01 (M): Übersicht aller Galerien mit Status, Speicherverbrauch und Ablaufdatum.
- F-DASH-02 (M): Statistiken pro Galerie: Aufrufe, Video-Wiedergaben, Downloads, Favoriten.
- F-DASH-03 (M): Auslieferungs-Mail an Kunden mit anpassbarem Text, in Creator-Branding.
- F-DASH-04 (S): Benachrichtigung an Creator bei Kauf, Trinkgeld, Bewertung, Favoriten-Export.

## Zentrale User Flows

**Creator (Vorbereitung):**

1. Galerie anlegen – Titel, Datum, Sets
2. Upload – Fotos und Videos
3. Verarbeitung – Bildgrößen, HLS (automatisch)
4. Design wählen – Theme, Logo, Musik
5. Veröffentlichen – Zugriff, Ablaufdatum

**Übergabe:** Galerie-Link per Auslieferungs-Mail oder geteilt.

**Kunde und Gäste:**

1. Link öffnen – Handy, PC oder TV
2. Passwort / PIN – nur falls gesetzt
3. Premiere – Countdown, nur falls gesetzt (Phase 2)
4. Galerie ansehen – Filme und Fotos
5. Interagieren – Favoriten, Download, Kaufen, Trinkgeld, Bewertung, Instagram-Share (Find my Face ab Phase 3)

Wird eine Datei später ersetzt, bleibt der Link gleich und der Kunde sieht automatisch die neue Version.

## Datenmodell

Kern ist die Kette Account → Gallery → Set → Media; alles andere hängt an Gallery oder Media. PostgreSQL, Mandantentrennung über `account_id`.

| Entität | Wichtige Felder | Beziehung |
| --- | --- | --- |
| Account | id, name, plan, storage_used_bytes, stripe_customer_id, branding (Logo, Farben, Fonts, Socials), custom_domain | hat viele User, Galleries |
| User | id, account_id, email, role (owner, member, admin), auth_provider | gehört zu Account |
| Gallery | id, account_id, slug, title, event_date, status, theme_id, cover_media_id, password_hash, expires_at, premiere_at, download_policy, watermark_id, music_track_id, face_search_enabled | hat viele Sets, Visitors |
| Set | id, gallery_id, title, type (photo, video), position, download_policy | hat viele Media |
| Media | id, set_id, type, original_key, bunny_video_id, variants (JSON: Größen, HLS-URL), width, height, duration_s, size_bytes, taken_at, position, revision, processing_status | gehört zu Set |
| VideoChapter | id, media_id, title, start_s | gehört zu Media (Phase 2) |
| Visitor | id, gallery_id, email (optional), role (client, guest), magic_token | hat Favorites, Orders |
| FavoriteList / Favorite | list: id, visitor_id, name · fav: list_id, media_id | Visitor ↔ Media |
| FaceEmbedding | id, media_id, bbox, vector (pgvector 512 d), expires_at | gehört zu Media (Phase 3) |
| Product / Order / OrderItem | product: account_id, type (digital, package), price · order: visitor_id, status, stripe_payment_intent | Gallery-Shop (Phase 2) |
| Tip | id, gallery_id, amount, message, stripe_payment_intent | gehört zu Gallery (Phase 2) |
| Review | id, gallery_id, visitor_id, rating 1–5, text, published | gehört zu Gallery (Phase 2) |
| Theme | id, name, config (JSON: Fonts, Farben, Layout) | von Galleries genutzt |
| Event (Analytics) | gallery_id, media_id, visitor_id, type (view, play, download, favorite), ts | Zeitreihe |

Speicherverbrauch wird bei jedem abgeschlossenen Upload oder Löschvorgang inkrementell auf `Account.storage_used_bytes` gebucht und nächtlich gegen den Storage abgeglichen.

## Systemarchitektur & Tech-Stack

Ein schlanker TypeScript-Monolith (Next.js) mit getrenntem Worker-Prozess: schnell gebaut, von einer Person betreibbar.

**Schichten:**

- **Frontends:** Galerie-App (SSR, mobile-first, HLS-Player mit AirPlay und Cast) · Creator-Dashboard (Upload, Editor mit Vorschau, Statistik, Abo) · Website-Embed (Video-Player als iFrame, Phase 2)
- **Edge:** CDN liefert Bilder und HLS-Segmente nur über signierte, kurzlebige URLs · Custom Domains je Creator mit automatischem TLS (Phase 2)
- **Backend:** API (Next.js Server Actions und Route Handler: Auth, Planlimits, Webhooks) · Job-Queue (Redis mit BullMQ) · Worker (Bilder mit sharp, Video-Übergabe an Bunny Stream, ZIP-Erstellung, Mails)
- **Daten und Dienste:** PostgreSQL · Cloudflare R2 (Fotos: Originale und Varianten) · Bunny Stream (Videos) · Stripe · Postmark

Uploads gehen direkt vom Browser in den Storage (Fotos nach R2, Videos per tus zu Bunny Stream). Die API legt danach Jobs in die Queue, die Worker schreiben Varianten zurück. Der App-Server trägt keinen Medien-Traffic.

| Baustein | Festgelegt |
| --- | --- |
| Frontend + Backend | Next.js (App Router), TypeScript strict, Tailwind CSS, shadcn/ui |
| Datenbank | PostgreSQL mit Drizzle ORM, selbst gehostet auf Hetzner |
| Queue | Redis mit BullMQ, eigener Worker-Prozess |
| Auth | Auth.js (Magic Link per Postmark, Google) |
| Fotos | Cloudflare R2 + sharp |
| Video | Bunny Stream (EU-Anbieter, verwaltet, Abrechnung nach Nutzung) |
| Player | hls.js, Google Cast Web Sender SDK, natives AirPlay in Safari |
| Zahlungen | Stripe Billing (Abos), Stripe Connect (Shop, Phase 2) |
| E-Mail | Postmark |
| i18n | next-intl, Deutsch |
| Tests | Vitest, Playwright |
| Hosting | Hetzner Cloud (Deutschland) mit Coolify |
| Fehler-Tracking | Sentry (EU-Region) |
| Gesichtserkennung | Phase 3: InsightFace auf EU-GPU-Server |

## Nicht-funktionale Anforderungen

| Bereich | Anforderung |
| --- | --- |
| Performance | Galerie-Startseite LCP < 2,5 s auf 4G; Thumbnails über CDN; Video-Start < 2 s |
| Upload | Dateien bis 50 GB pro Video, fortsetzbar; 1.000 Fotos in einem Vorgang |
| Skalierung | Verarbeitung als Job-Queue, horizontal skalierbar; Lastspitzen in Hochzeitssaison (Mai–Oktober) |
| Verfügbarkeit | 99,9 % für Galerie-Auslieferung; Dashboard 99,5 % |
| Datenhaltung | Originale redundant; tägliches DB-Backup, 30 Tage Aufbewahrung |
| DSGVO | Hosting und Verarbeitung in der EU; AV-Vertrag mit Creators; Cookie-Banner nur für nicht-essenzielle Cookies |
| Gesichtserkennung | Phase 3, biometrische Daten (Art. 9 DSGVO): nur nach Opt-in pro Galerie, eigenes EU-Modell, Löschung mit Galerie |
| Sicherheit | Medien nur über signierte, kurzlebige URLs; Passwörter mit Argon2; Rate-Limit auf Passwort-Galerien; 2FA für Creator |
| Barrierefreiheit | WCAG 2.1 AA für Galerie-Ansicht (EU Accessibility Act) |
| Sprache | UI Deutsch zum Start; alle Texte von Anfang an in i18n-Dateien, damit Englisch später ohne Umbau folgt |
| Geräte | Galerie mobile-first; Dashboard ab Tablet |

## Preismodell & Monetarisierung

Abos gestaffelt nach Gesamtspeicher, Features an Stufen gebunden, Galerien immer unbegrenzt. Preise in EUR. Keine Transaktionsgebühr auf Shop-Verkäufe und Trinkgeld (0 % Provision), Einnahmen nur aus Abos. Ein Free-Plan (z. B. 3 Galerien, 2 GB) senkt die Einstiegshürde.

**EUR-Preise und Plan-Namen sind noch offen – in lib/plans.ts als Platzhalter anlegen.**

Referenz Gallerio ([Preisseite](https://gallerio.co/plans), USD/Monat, Stand 11.10.2026):

| Plan | Speicher gesamt | Preis/Monat | Zusätzliche Features |
| --- | --- | --- | --- |
| Starter | 20 GB | $14 | Basis: unbegrenzte Galerien, Verkauf, Logo, Themes, 4K, TV-Streaming, Hybrid, Musik, Passwort, Wasserzeichen, Favoriten, Bewertungen, Instagram-Share |
| Side Line | 100 GB | $24 | + Video-Cover, Branding & Socials, Trinkgeld, Premiere, Find my Face |
| Advanced | 600 GB | $45 | + White-Label-Links, externe Download-Links, Video-Kapitel |
| Ultimate | 1.200 GB | $62 | wie Advanced, mehr Speicher |
| Studio | 2 TB | $99 | alle Features |
| Power Creator | 5 TB | $199 | alle Features |

## MVP-Umfang & Roadmap

Das MVP umfasst alle Anforderungen mit Priorität **M**.

**Phase 1 – MVP:** Konto & Abo, Upload mit Verarbeitung, Sets, Themes mit Live-Vorschau, Netflix-Ansicht mit HLS-Player und TV-Streaming, Passwort, Download-Rechte, Wasserzeichen, Favoriten, Auslieferungs-Mail, Dashboard mit Basis-Statistik.

**Phase 2 – Differenzierung:** Premiere mit Countdown, digitaler Shop und Trinkgeld über Stripe Connect (0 % Provision), White-Label-Subdomains, Video-Kapitel, Video-Cover, Galerie-Musik, Bewertungen, Website-Embeds, externe Download-Links.

**Phase 3 – Skalierung:** Find my Face (nach Datenschutz-Prüfung), Teams, Lightroom-Plugin, Druck-Partner für Prints (optional), CRM-Anbindung, native Apps für Apple TV und Android TV.

## Entscheidungen

| Frage | Entscheidung |
| --- | --- |
| Zielmarkt | Vorerst DACH, Preise in EUR, UI Deutsch |
| Video-Encoding | Bunny Stream (wenig Entwicklungszeit, niedrige Kosten, skalierbar) |
| Druck-Partner | Vorerst nicht, nur digitale Produkte |
| Transaktionsgebühr | Nein, 0 % Provision |
| Find my Face | Nicht im MVP, Phase 3 nach Datenschutz-Prüfung |
| Name | Roses Gallery |
| Server | Bestehender Hetzner-Server |
