import { LegalPage, legalMetadata } from "@/components/legal-page";

export function generateMetadata() {
  return legalMetadata("datenschutz");
}

export default function Page() {
  return <LegalPage page="datenschutz" />;
}
