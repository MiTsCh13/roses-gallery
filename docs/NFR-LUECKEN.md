# Lückenliste Nicht-funktionale Anforderungen (M10)

Stand 2026-10-29, geprüft gegen den Code auf `main`. ✅ erfüllt · 🟡 teilweise · ❌ offen.

| Bereich | Stand | Lücke / nächster Schritt |
| --- | --- | --- |
| Performance | ✅ | LCP 0,9 s lokal (Lighthouse-Skript, M7). Live gegen R2/CDN ungeprüft; Video-Start < 2 s nur mit Live-HLS prüfbar (D-117) |
| Upload | 🟡 | Foto-Multipart und Video-tus fortsetzbar im Client-Code; Fortsetzen nach Reload bei Video offen; 1.000 Fotos/Vorgang ungetestet |
| Skalierung | ✅ | BullMQ-Worker, Jobs idempotent; mehrere Worker-Instanzen möglich (Lasttest offen) |
| Verfügbarkeit | ❌ | Kein Monitoring/Uptime-Check, kein Sentry, kein Deployment → Sentry, Health-Endpoint vorhanden (`/api/health`), Deployment-Doku |
| Datenhaltung | ❌ | Kein DB-Backup, keine Wiederherstellungs-Doku. R2-Redundanz liegt beim Anbieter |
| DSGVO | 🟡 | Statistik ohne Cookies (D-127) ✅; Impressum/Datenschutz/AGB-Seiten fehlen; keine Aufbewahrungsfrist für Events; AV-Vertrag = Rechtstext; Hosting-Region EU beim Deployment sicherstellen |
| Gesichtserkennung | ➖ | Phase 3, nicht Teil des MVP |
| Sicherheit | 🟡 | Signierte URLs ✅, Passwort-Rate-Limit ✅, scrypt statt Argon2 (D-122), Security-Header + CSP ✅ (D-129); **2FA für Creator fehlt**; Rate-Limit für Login/Magic Link prüfen; `x-forwarded-for` hinter Proxy (D-122) |
| Barrierefreiheit | ❌ | Kein automatisierter axe-Test, Fokus/Kontraste/Alt-Texte der Galerie-Ansicht ungeprüft |
| Sprache | ✅ | Alle UI-Texte über `messages/de.json` |
| Geräte | ✅ | Galerie mobile-first, E2E läuft als Desktop und Mobil |

Reihenfolge der Umsetzung siehe `docs/STATUS.md` (M10).
