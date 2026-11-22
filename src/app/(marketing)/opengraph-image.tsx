import { getTranslations } from "next-intl/server";

import { brandImage, OG_SIZE } from "@/lib/og-image";

export const alt = "Roses Gallery";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const t = await getTranslations("HomePage");
  return brandImage({ title: t("ogTitle"), subtitle: t("tagline") });
}
