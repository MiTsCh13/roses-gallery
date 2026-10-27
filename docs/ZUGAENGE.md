# Testzugänge & Umgebungsvariablen

Alle Schlüssel gehören **nur** in die Cloud-Umgebung der Routine (claude.ai/code →
Umgebung bearbeiten → Umgebungsvariablen) bzw. lokal in `.env.local`. Nie ins Repo,
nie in den Chat. Ohne Schlüssel laufen alle Dienste gegen Fakes (D-101); die
Zugänge werden nur für die Abnahme gegen echte Dienste gebraucht.

| Dienst | Gebraucht ab | Variablen | Pflicht? |
| --- | --- | --- | --- |
| Auth.js | M1 | `AUTH_SECRET`, `AUTH_URL` | `AUTH_SECRET` ja, sobald echte Sessions laufen |
| Postmark | M1 (Magic Link), M9 | `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM` | optional |
| Google OAuth | M1 | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | optional |
| Stripe (Testmodus) | M2 | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | optional |
| Cloudflare R2 | M3 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | optional |
| Bunny Stream | M4 | `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_KEY` | optional |
| Sentry (EU) | M10 | `SENTRY_DSN` | optional |

Schalter: `MAIL_TRANSPORT`, `BILLING_TRANSPORT`, `STORAGE_TRANSPORT` (`fake` oder
der echte Dienst). Nicht gesetzt = automatisch echt, sobald der Schlüssel da ist,
sonst Fake. `E2E_TEST_MODE=1` nur in der E2E-Umgebung, nie in Produktion.

## Anleitungen

### Auth.js
- `AUTH_SECRET`: zufälliger String, z. B. `openssl rand -base64 32`.
- `AUTH_URL`: öffentliche Basis-URL der App (lokal `http://localhost:3000`).

### Postmark (E-Mail)
1. Konto auf postmarkapp.com anlegen, Server erstellen (Name z. B. „Roses Gallery Test“).
2. Tab **API Tokens** → *Server API token* kopieren → `POSTMARK_SERVER_TOKEN`.
3. **Sender Signatures**: eine Absenderadresse bestätigen (oder Domain mit DKIM/SPF
   verifizieren) → `EMAIL_FROM`, z. B. `Roses Gallery <login@deine-domain.de>`.
4. Neue Postmark-Konten sind im Testmodus: Mails gehen nur an Adressen der eigenen
   Domain, bis Postmark das Konto freigibt (Antrag im Dashboard).

### Google-Login
1. console.cloud.google.com → Projekt anlegen → **APIs & Dienste → OAuth-Zustimmungsbildschirm**
   (extern, Testmodus, eigene Adresse als Testnutzer).
2. **Anmeldedaten → OAuth-Client-ID erstellen** → Typ *Webanwendung*.
3. Autorisierte Weiterleitungs-URI: `http://localhost:3000/api/auth/callback/google`
   (später zusätzlich `https://<deine-domain>/api/auth/callback/google`).
4. Client-ID → `AUTH_GOOGLE_ID`, Clientschlüssel → `AUTH_GOOGLE_SECRET`.

### Stripe (Testmodus)
1. Konto auf stripe.com anlegen; oben **Testmodus** aktiv lassen.
2. Entwickler → **API-Schlüssel** → *Geheimer Schlüssel* (`sk_test_…`) → `STRIPE_SECRET_KEY`.
3. Webhook-Secret (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`:
   - Lokal: Stripe CLI installieren, `stripe login`, dann
     `stripe listen --forward-to localhost:3000/api/stripe/webhook` – gibt das Secret aus.
   - Deployt: Entwickler → Webhooks → Endpunkt `https://<domain>/api/stripe/webhook`
     mit den Ereignissen `customer.subscription.created`, `.updated`, `.deleted`.
4. **Einstellungen → Billing → Kundenportal** aktivieren (Planwechsel, Kündigung,
   Rechnungen erlauben), sonst schlägt „Abo verwalten“ fehl.
5. Testkarte: `4242 4242 4242 4242`, beliebiges Ablaufdatum/CVC.
Preise legt der Code selbst an (`price_data`), im Dashboard sind keine Produkte nötig.

### Cloudflare R2
1. dash.cloudflare.com → **R2 Object Storage** aktivieren (Zahlungsmittel nötig, Free-Kontingent vorhanden).
2. Bucket anlegen (z. B. `roses-gallery-dev`), **öffentlichen Zugriff aus lassen** → `R2_BUCKET`.
3. Konto-ID (rechte Seitenleiste der R2-Übersicht) → `R2_ACCOUNT_ID`.
4. **API-Tokens verwalten → Account-API-Token erstellen**, Berechtigung *Object Read & Write*
   auf dieses Bucket → *Access Key ID* → `R2_ACCESS_KEY_ID`, *Secret Access Key* → `R2_SECRET_ACCESS_KEY`
   (wird nur einmal angezeigt).
5. Bucket → Einstellungen → **CORS-Richtlinie** für Browser-Uploads (Uppy):
   erlaubte Origins = App-URL(s), Methoden `GET, PUT, POST, HEAD`, Header `*`,
   Expose-Header `ETag`.

### Bunny Stream (ab M4)
1. bunny.net-Konto, **Stream → Add Video Library** (Name, Region EU).
2. Library → **API**: *Library ID* → `BUNNY_STREAM_LIBRARY_ID`, *API Key* → `BUNNY_STREAM_API_KEY`.
3. Library → **Security**: *Token Authentication* aktivieren, den Key → `BUNNY_STREAM_TOKEN_KEY`
   (für signierte, kurzlebige Wiedergabe-URLs).

### Sentry (ab M10)
sentry.io → Projekt (Next.js), Datenregion **EU** wählen → DSN → `SENTRY_DSN`.

## Wo eintragen?
- **Routine/Cloud-Sessions:** claude.ai/code → Umgebung der Routine → Umgebungsvariablen.
- **Lokal:** `.env.example` nach `.env.local` kopieren und füllen.
- **GitHub Actions:** nur nötig, wenn die CI einmal echte Dienste nutzen soll (aktuell nicht):
  Repo → Settings → Secrets and variables → Actions.
