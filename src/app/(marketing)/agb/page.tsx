import { LegalPage, legalMetadata } from "@/components/legal-page";

export function generateMetadata() {
  return legalMetadata("agb");
}

export default function Page() {
  return <LegalPage page="agb" />;
}
