import { LegalPage, legalMetadata } from "@/components/legal-page";

export function generateMetadata() {
  return legalMetadata("impressum");
}

export default function Page() {
  return <LegalPage page="impressum" />;
}
