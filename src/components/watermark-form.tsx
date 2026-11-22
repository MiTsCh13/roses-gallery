import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WATERMARK_POSITIONS, type WatermarkConfig } from "@/lib/watermark";

// Account-wide watermark settings (position, opacity, size). Shown in the
// profile (default for all galleries) and in the gallery editor.
export async function WatermarkForm({
  action,
  config,
  hasLogo,
  galleryId,
}: {
  action: (formData: FormData) => Promise<void>;
  config: WatermarkConfig;
  hasLogo: boolean;
  galleryId?: string;
}) {
  const t = await getTranslations("Galleries");
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {hasLogo ? t("watermarkHint") : t("watermarkNoLogo")}
      </p>
      <form action={action} className="space-y-3" data-testid="watermark-form">
        {galleryId && (
          <input type="hidden" name="galleryId" value={galleryId} />
        )}
        <label className="block space-y-1 text-sm">
          <span>{t("watermarkPosition")}</span>
          <select
            name="position"
            defaultValue={config.position}
            className="h-9 w-full rounded-md border bg-transparent px-3"
          >
            {WATERMARK_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {t(`watermarkPositions.${p}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("watermarkOpacity")}</span>
          <Input
            name="opacity"
            type="number"
            min={5}
            max={100}
            defaultValue={config.opacity}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>{t("watermarkScale")}</span>
          <Input
            name="scale"
            type="number"
            min={5}
            max={60}
            defaultValue={config.scale}
          />
        </label>
        <Button type="submit" variant="outline">
          {t("watermarkSave")}
        </Button>
      </form>
    </>
  );
}
