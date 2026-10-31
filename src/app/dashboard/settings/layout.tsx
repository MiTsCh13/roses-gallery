import { getTranslations } from "next-intl/server";

import { SettingsTabs } from "./settings-tabs";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("Settings");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-2 px-6 pt-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {t("title")}
      </h1>
      <SettingsTabs
        label={t("tabsLabel")}
        tabs={[
          { href: "/dashboard/settings", label: t("tabs.profile") },
          { href: "/dashboard/settings/billing", label: t("tabs.billing") },
          { href: "/dashboard/settings/security", label: t("tabs.security") },
        ]}
      />
      {children}
    </div>
  );
}
