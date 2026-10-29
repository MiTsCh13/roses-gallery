import { afterEach, describe, expect, it, vi } from "vitest";

import { buildEnvelope, parseDsn, reportError } from "./error-reporter";

const DSN = "https://abc123@o1.ingest.de.sentry.io/42";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("parseDsn", () => {
  it("leitet Endpunkt und Schlüssel ab", () => {
    expect(parseDsn(DSN)).toEqual({
      key: "abc123",
      endpoint: "https://o1.ingest.de.sentry.io/api/42/envelope/",
    });
  });

  it("ignoriert leere oder kaputte DSNs", () => {
    expect(parseDsn("")).toBeNull();
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("kein-url")).toBeNull();
    expect(parseDsn("https://host/42")).toBeNull();
  });
});

describe("buildEnvelope", () => {
  it("enthält Meldung und Tags, aber keine Request-Daten", () => {
    const lines = buildEnvelope(
      new Error("kaputt"),
      { job: "build-zip" },
      DSN,
    ).split("\n");
    expect(JSON.parse(lines[1]!)).toEqual({ type: "event" });
    const event = JSON.parse(lines[2]!);
    expect(event.exception.values[0].value).toBe("kaputt");
    expect(event.tags).toEqual({ job: "build-zip" });
    expect(event.request).toBeUndefined();
  });
});

describe("reportError", () => {
  it("sendet ohne DSN nichts", async () => {
    vi.stubEnv("SENTRY_DSN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await reportError(new Error("x"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("postet an den Envelope-Endpunkt und schluckt Netzfehler", async () => {
    vi.stubEnv("SENTRY_DSN", DSN);
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await reportError(new Error("x"), { job: "j" });
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://o1.ingest.de.sentry.io/api/42/envelope/",
    );
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(reportError(new Error("y"))).resolves.toBeUndefined();
  });
});
