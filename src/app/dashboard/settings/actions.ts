"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { db } from "@/db";
import { PasswordError, setAccountPassword } from "@/lib/account-password";
import { BrandingError, removeLogo } from "@/lib/branding";
import { saveProfile } from "@/lib/profile";
import { requireAccount } from "@/lib/session";
import { getStorage } from "@/lib/storage";

const text = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
};

export async function saveProfileAction(formData: FormData) {
  const { account, user } = await requireAccount();
  try {
    await saveProfile(db(), account.id, user.id, {
      studioName: text(formData, "studioName"),
      contactName: text(formData, "contactName"),
      phone: text(formData, "phone"),
      website: text(formData, "website"),
      instagram: text(formData, "instagram"),
    });
  } catch (e) {
    if (e instanceof ZodError) redirect("/dashboard/settings?error=invalid");
    throw e;
  }
  redirect("/dashboard/settings?saved=1");
}

export async function removeAccountLogoAction() {
  const { account } = await requireAccount();
  try {
    await removeLogo({
      db: db(),
      storage: getStorage(),
      accountId: account.id,
    });
  } catch (e) {
    if (!(e instanceof BrandingError)) throw e;
  }
  redirect("/dashboard/settings?saved=1");
}

export async function savePasswordAction(formData: FormData) {
  const { account, user } = await requireAccount();
  const next = text(formData, "next");
  if (next !== text(formData, "repeat")) {
    redirect("/dashboard/settings?error=password_invalid");
  }
  try {
    await setAccountPassword(db(), account.id, user.id, {
      current: text(formData, "current"),
      next,
    });
  } catch (e) {
    if (e instanceof ZodError) {
      redirect("/dashboard/settings?error=password_invalid");
    }
    if (e instanceof PasswordError && e.code === "wrong_current") {
      redirect("/dashboard/settings?error=wrong_current");
    }
    throw e;
  }
  redirect("/dashboard/settings?saved=1");
}
