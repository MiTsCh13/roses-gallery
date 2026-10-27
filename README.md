# Roses Gallery

Gebrandete Foto- und Video-Galerien für Hochzeitsfotografen und -videografen im DACH-Raum.

- Spezifikation: [docs/SPEC.md](docs/SPEC.md)
- Umsetzungsplan: [docs/UMSETZUNGSPLAN.md](docs/UMSETZUNGSPLAN.md)
- **Aktueller Stand:** [docs/STATUS.md](docs/STATUS.md) · Entscheidungen: [docs/DECISIONS.md](docs/DECISIONS.md)

## Lokal starten

```bash
cp .env.example .env.local   # Werte eintragen
docker compose up -d         # Postgres + Redis
pnpm install
pnpm dev                     # http://localhost:3000
pnpm worker                  # Hintergrund-Jobs
```

## Qualität

```bash
pnpm check      # lint, format, typecheck, unit tests
pnpm test:e2e   # Playwright (Desktop + Mobil)
```
