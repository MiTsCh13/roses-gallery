# Ein Image für App und Worker (D-136). Start-Befehl entscheidet:
#   App:    pnpm start            Worker: pnpm worker
FROM node:22-bookworm-slim

# pg_dump für den täglichen Backup-Job (Version = Postgres 16)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && install -d /usr/share/keyrings \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-16 \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Der Build prüft die Umgebung beim Vorrendern; echte Werte gibt es erst zur Laufzeit
# (Platzhalter gelten nur für diesen Schritt und landen nicht im Image-Env).
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    REDIS_URL=redis://localhost:6379 \
    pnpm build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["pnpm", "start"]
