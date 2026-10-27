import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { locales } from "./config";

const messagesDir = join(process.cwd(), "messages");

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === "object"
      ? keys(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("message catalogues", () => {
  it("exist for every configured locale and nothing else", () => {
    const files = readdirSync(messagesDir).map((f) => f.replace(/\.json$/, ""));
    expect(files.sort()).toEqual([...locales].sort());
  });

  it("contain no empty strings", () => {
    for (const locale of locales) {
      const messages = JSON.parse(
        readFileSync(join(messagesDir, `${locale}.json`), "utf8"),
      );
      for (const key of keys(messages)) {
        const value = key
          .split(".")
          .reduce<unknown>(
            (acc, part) => (acc as Record<string, unknown>)[part],
            messages,
          );
        expect(value, `${locale}:${key}`).not.toBe("");
      }
    }
  });
});
