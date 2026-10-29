import { randomUUID } from "node:crypto";

// Fehlermeldung an Sentry (EU) über die Envelope-API, ohne SDK. Ohne
// `SENTRY_DSN` ist alles ein No-op. Gesendet werden nur Typ, Meldung, Stack
// und frei gewählte Tags (keine Header, Cookies, Nutzer- oder Request-Daten).

export type ErrorContext = Record<string, string>;

interface ParsedDsn {
  key: string;
  endpoint: string;
}

export function parseDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+/, "");
    if (!url.username || !projectId) return null;
    return {
      key: url.username,
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
    };
  } catch {
    return null;
  }
}

export function buildEnvelope(
  error: unknown,
  context: ErrorContext,
  dsn: string,
  now = new Date(),
): string {
  const err = error instanceof Error ? error : new Error(String(error));
  const eventId = randomUUID().replaceAll("-", "");
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: "node",
    level: "error",
    environment: process.env.NODE_ENV,
    tags: context,
    exception: {
      values: [{ type: err.name, value: err.message, stacktrace: undefined }],
    },
    extra: { stack: err.stack },
  };
  return [
    JSON.stringify({ event_id: eventId, dsn, sent_at: now.toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
}

export async function reportError(
  error: unknown,
  context: ErrorContext = {},
): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  const parsed = parseDsn(dsn);
  if (!parsed || !dsn) return;
  try {
    await fetch(parsed.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.key}, sentry_client=roses-gallery/1`,
      },
      body: buildEnvelope(error, context, dsn),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Monitoring darf die Anfrage nie scheitern lassen.
  }
}
