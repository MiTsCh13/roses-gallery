import { describe, expect, it } from "vitest";

import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUri,
  totpCode,
  verifyTotp,
} from "./totp";

// RFC 6238 Appendix B (SHA1), secret "12345678901234567890", 8 digits → last 6.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("matches the RFC 6238 test vectors", () => {
    expect(totpCode(RFC_SECRET, 59_000)).toBe("287082");
    expect(totpCode(RFC_SECRET, 1_111_111_109_000)).toBe("081804");
    expect(totpCode(RFC_SECRET, 2_000_000_000_000)).toBe("279037");
  });

  it("round-trips base32", () => {
    const secret = generateTotpSecret();
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("accepts the adjacent steps and returns the matched step", () => {
    const now = 1_111_111_109_000;
    expect(verifyTotp(RFC_SECRET, "081804", now)).toBe(37037036);
    expect(verifyTotp(RFC_SECRET, "081804", now + 30_000)).toBe(37037036);
    expect(verifyTotp(RFC_SECRET, "081 804", now)).toBe(37037036);
  });

  it("rejects stale, malformed and wrong codes", () => {
    const now = 1_111_111_109_000;
    expect(verifyTotp(RFC_SECRET, "081804", now + 90_000)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "12345", now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef", now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "000000", now)).toBeNull();
  });

  it("builds an otpauth URI", () => {
    const uri = otpauthUri("ABC234", "anna@foto-rose.de");
    expect(uri).toContain(
      "otpauth://totp/Roses%20Gallery%3Aanna%40foto-rose.de",
    );
    expect(uri).toContain("secret=ABC234");
  });
});
