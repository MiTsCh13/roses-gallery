// Anbieterdaten für Impressum, Datenschutzerklärung und AGB. Kommen aus der
// Umgebung (Coolify), damit keine Privatadresse im Repository steht.
export const LEGAL_FIELDS = [
  "LEGAL_NAME",
  "LEGAL_ADDRESS",
  "LEGAL_EMAIL",
  "LEGAL_PHONE",
  "LEGAL_VAT_ID",
] as const;

export type LegalField = (typeof LEGAL_FIELDS)[number];

export const LEGAL_MISSING = "[bitte ergänzen]";

/** Freiwillige Angaben: leer = Abschnitt entfällt (z. B. keine USt-ID). */
export const OPTIONAL_LEGAL_FIELDS: readonly LegalField[] = ["LEGAL_VAT_ID"];

export function legalDetails(
  source: Record<string, string | undefined> = process.env,
): Record<LegalField, string> {
  const out = {} as Record<LegalField, string>;
  for (const field of LEGAL_FIELDS) {
    const value = source[field]?.trim();
    out[field] =
      value || (OPTIONAL_LEGAL_FIELDS.includes(field) ? "" : LEGAL_MISSING);
  }
  return out;
}

/** Ersetzt `{LEGAL_NAME}` usw. im Text; `\n` im Wert bleibt erhalten. */
export function fillLegalText(
  text: string,
  details: Record<LegalField, string>,
): string {
  return text.replace(
    /\{(LEGAL_[A-Z_]+)\}/g,
    (match, key: string) => details[key as LegalField] ?? match,
  );
}

export function hasMissingLegalDetails(
  details: Record<LegalField, string>,
): boolean {
  return Object.values(details).includes(LEGAL_MISSING);
}
