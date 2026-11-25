import type { Metadata } from "next";

import {
  AudiencePage,
  audienceMetadata,
} from "@/components/marketing/audience-page";

export function generateMetadata(): Promise<Metadata> {
  return audienceMetadata("photographers");
}

export default function Page() {
  return <AudiencePage audience="photographers" />;
}
