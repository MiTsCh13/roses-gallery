import { describe, expect, it } from "vitest";
import {
  fillLegalText,
  hasMissingLegalDetails,
  legalDetails,
  LEGAL_MISSING,
} from "./legal-details";

describe("legal details", () => {
  it("marks unset fields as missing", () => {
    const details = legalDetails({ LEGAL_NAME: "Rosa Muster" });
    expect(details.LEGAL_NAME).toBe("Rosa Muster");
    expect(details.LEGAL_EMAIL).toBe(LEGAL_MISSING);
    expect(hasMissingLegalDetails(details)).toBe(true);
  });

  it("treats blank values as missing", () => {
    expect(legalDetails({ LEGAL_PHONE: "  " }).LEGAL_PHONE).toBe(LEGAL_MISSING);
  });

  it("is complete when every field is set", () => {
    const details = legalDetails({
      LEGAL_NAME: "a",
      LEGAL_ADDRESS: "b",
      LEGAL_EMAIL: "c",
      LEGAL_PHONE: "d",
      LEGAL_VAT_ID: "e",
    });
    expect(hasMissingLegalDetails(details)).toBe(false);
  });

  it("fills known placeholders and keeps unknown ones", () => {
    const details = legalDetails({ LEGAL_EMAIL: "hi@example.de" });
    expect(fillLegalText("Mail: {LEGAL_EMAIL} {LEGAL_X}", details)).toBe(
      "Mail: hi@example.de {LEGAL_X}",
    );
  });
});
