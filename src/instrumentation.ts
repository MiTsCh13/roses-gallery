import { reportError } from "@/lib/error-reporter";

// Serverfehler aus Routen, Server Actions und Rendering → Sentry (No-op ohne DSN).
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routeType: string },
) {
  await reportError(error, {
    route: request.path.split("?")[0] ?? "",
    method: request.method,
    routeType: context.routeType,
  });
}
