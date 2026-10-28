import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildZip } from "./zip-writer";

describe("buildZip", () => {
  it("writes the end-of-central-directory record for an empty archive", () => {
    const zip = buildZip([]);
    expect(zip.length).toBe(22);
    expect(zip.readUInt32LE(0)).toBe(0x06054b50);
  });

  it("produces an archive that unzip accepts, with names and content intact", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "roses-zip-"));
    const file = path.join(dir, "a.zip");
    writeFileSync(
      file,
      buildZip([
        { name: "Trauung/1.webp", data: Buffer.from("hello") },
        { name: "Bräutigam/2.webp", data: Buffer.alloc(100_000, 7) },
      ]),
    );
    let listing: string;
    try {
      listing = execFileSync("unzip", ["-t", file], { encoding: "utf8" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return; // no unzip binary
      throw error;
    }
    expect(listing).toContain("No errors detected");
    const text = execFileSync("unzip", ["-p", file, "Trauung/1.webp"], {
      encoding: "utf8",
    });
    expect(text).toBe("hello");
  });
});
