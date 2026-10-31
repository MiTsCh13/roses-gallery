import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";

import { db } from "@/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logoUrl } from "@/lib/branding";
import { getProfile } from "@/lib/profile";
import { requireAccount } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { removeAccountLogoAction, saveProfileAction } from "./actions";

async function ProfileContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await connection();
  const [t, { account, user }, { error, saved }] = await Promise.all([
    getTranslations("Settings"),
    requireAccount(),
    searchParams,
  ]);
  const [profile, logo] = await Promise.all([
    getProfile(db(), account.id, user.id),
    logoUrl({ db: db(), storage: getStorage(), accountId: account.id }),
  ]);

  const field = (
    name: string,
    value: string | null,
    extra: { type?: string; required?: boolean; placeholder?: string } = {},
  ) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{t(`profile.${name}`)}</span>
      <Input
        name={name}
        defaultValue={value ?? ""}
        maxLength={200}
        {...extra}
      />
    </label>
  );

  return (
    <main className="flex flex-col gap-8 py-8">
      {saved && (
        <p role="status" className="text-sm text-primary">
          {t("saved")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}

      <section aria-labelledby="profile-data" className="space-y-4">
        <h2 id="profile-data" className="font-display text-xl font-semibold">
          {t("profile.title")}
        </h2>
        <form action={saveProfileAction} className="grid gap-4 sm:grid-cols-2">
          {field("studioName", profile.studioName, { required: true })}
          {field("contactName", profile.contactName)}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("profile.email")}</span>
            <Input value={profile.email} readOnly disabled />
          </label>
          {field("phone", profile.phone, { type: "tel" })}
          {field("website", profile.website, {
            type: "url",
            placeholder: "https://",
          })}
          {field("instagram", profile.instagram, { placeholder: "@" })}
          <div className="sm:col-span-2">
            <Button type="submit">{t("save")}</Button>
          </div>
        </form>
      </section>

      <section aria-labelledby="profile-logo" className="space-y-3">
        <h2 id="profile-logo" className="font-display text-xl font-semibold">
          {t("logo.title")}
        </h2>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={t("logo.alt")}
            className="max-h-24 rounded-md border bg-card p-2"
          />
        )}
        <form
          method="post"
          action="/api/branding/logo"
          encType="multipart/form-data"
          className="space-y-2"
        >
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp"
            aria-label={t("logo.file")}
            required
            className="text-sm"
          />
          <p className="text-sm text-muted-foreground">{t("logo.hint")}</p>
          <Button type="submit" variant="outline">
            {t("logo.upload")}
          </Button>
        </form>
        {logo && (
          <form action={removeAccountLogoAction}>
            <Button type="submit" variant="ghost">
              {t("logo.remove")}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}

export default function SettingsPage(props: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  return (
    <Suspense>
      <ProfileContent {...props} />
    </Suspense>
  );
}
