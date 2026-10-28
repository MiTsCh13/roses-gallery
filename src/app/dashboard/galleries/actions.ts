"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  createGallery,
  createSet,
  GalleryError,
  reorderMedia,
  reorderSets,
  setGalleryCover,
  updateGallery,
} from "@/lib/galleries";
import { BrandingError, removeLogo } from "@/lib/branding";
import { setSetDownloadPolicy } from "@/lib/downloads";
import { setGalleryPassword } from "@/lib/gallery-access";
import { getStorage } from "@/lib/storage";
import { saveGalleryDesign } from "@/lib/gallery-design";
import { PlanLimitError } from "@/lib/plans";
import { saveWatermarkConfig } from "@/lib/watermark";
import { requireAccount } from "@/lib/session";
import { ZodError } from "zod";

function errorCode(e: unknown): string {
  if (e instanceof PlanLimitError) return e.code;
  if (e instanceof GalleryError) return e.code;
  if (e instanceof BrandingError) return e.code;
  if (e instanceof ZodError) return "invalid";
  throw e;
}

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === "string" ? v : undefined;
}

export async function createGalleryAction(formData: FormData) {
  const { account } = await requireAccount();
  let id: string;
  try {
    ({ id } = await createGallery(
      { db: db(), accountId: account.id },
      {
        title: field(formData, "title"),
        slug: field(formData, "slug"),
        eventDate: field(formData, "eventDate"),
        expiresAt: field(formData, "expiresAt"),
      },
    ));
  } catch (e) {
    redirect(`/dashboard/galleries/new?error=${errorCode(e)}`);
  }
  redirect(`/dashboard/galleries/${id}`);
}

export async function updateGalleryAction(formData: FormData) {
  const { account } = await requireAccount();
  const galleryId = field(formData, "galleryId") ?? "";
  try {
    await updateGallery(
      { db: db(), accountId: account.id },
      {
        galleryId,
        title: field(formData, "title"),
        slug: field(formData, "slug"),
        eventDate: field(formData, "eventDate"),
        expiresAt: field(formData, "expiresAt"),
        status: field(formData, "status"),
        downloadPolicy: field(formData, "downloadPolicy"),
        watermarkEnabled: field(formData, "watermarkEnabled") === "on",
      },
    );
  } catch (e) {
    redirect(`/dashboard/galleries/${galleryId}?error=${errorCode(e)}`);
  }
  revalidatePath("/dashboard/galleries");
  redirect(`/dashboard/galleries/${galleryId}?saved=1`);
}

export async function saveWatermarkAction(formData: FormData) {
  const { account } = await requireAccount();
  const galleryId = field(formData, "galleryId") ?? "";
  try {
    await saveWatermarkConfig(
      { db: db(), accountId: account.id },
      {
        position: field(formData, "position"),
        opacity: field(formData, "opacity"),
        scale: field(formData, "scale"),
      },
    );
  } catch (e) {
    redirect(`/dashboard/galleries/${galleryId}?error=${errorCode(e)}`);
  }
  revalidatePath(`/dashboard/galleries/${galleryId}`);
  redirect(`/dashboard/galleries/${galleryId}?saved=1`);
}

export async function setGalleryPasswordAction(formData: FormData) {
  const { account } = await requireAccount();
  const galleryId = field(formData, "galleryId") ?? "";
  const remove = field(formData, "intent") === "remove";
  try {
    await setGalleryPassword(
      { db: db(), accountId: account.id },
      galleryId,
      remove ? null : (field(formData, "password") ?? ""),
    );
  } catch (e) {
    redirect(`/dashboard/galleries/${galleryId}?error=${errorCode(e)}`);
  }
  revalidatePath(`/dashboard/galleries/${galleryId}`);
  redirect(`/dashboard/galleries/${galleryId}?saved=1`);
}

export async function setSetDownloadPolicyAction(formData: FormData) {
  const { account } = await requireAccount();
  const setId = field(formData, "setId") ?? "";
  try {
    await setSetDownloadPolicy(
      { db: db(), accountId: account.id },
      setId,
      field(formData, "downloadPolicy"),
    );
  } catch (e) {
    redirect(`/dashboard/sets/${setId}?error=${errorCode(e)}`);
  }
  revalidatePath(`/dashboard/sets/${setId}`);
}

export async function createSetAction(formData: FormData) {
  const { account } = await requireAccount();
  const galleryId = field(formData, "galleryId") ?? "";
  try {
    await createSet(
      { db: db(), accountId: account.id },
      {
        galleryId,
        title: field(formData, "title"),
        type: field(formData, "type"),
      },
    );
  } catch (e) {
    redirect(`/dashboard/galleries/${galleryId}?error=${errorCode(e)}`);
  }
  redirect(`/dashboard/galleries/${galleryId}`);
}

export async function reorderSetsAction(
  galleryId: string,
  orderedIds: string[],
) {
  const { account } = await requireAccount();
  await reorderSets({ db: db(), accountId: account.id }, galleryId, orderedIds);
  revalidatePath(`/dashboard/galleries/${galleryId}`);
}

export async function reorderMediaAction(setId: string, orderedIds: string[]) {
  const { account } = await requireAccount();
  await reorderMedia({ db: db(), accountId: account.id }, setId, orderedIds);
  revalidatePath(`/dashboard/sets/${setId}`);
}

export async function setCoverAction(formData: FormData) {
  const { account } = await requireAccount();
  const galleryId = field(formData, "galleryId") ?? "";
  const setId = field(formData, "setId") ?? "";
  const mediaId = field(formData, "mediaId");
  try {
    await setGalleryCover(
      { db: db(), accountId: account.id },
      galleryId,
      mediaId ? mediaId : null,
    );
  } catch (e) {
    errorCode(e);
  }
  redirect(`/dashboard/sets/${setId}?cover=1`);
}

export async function saveDesignAction(formData: FormData) {
  const { account } = await requireAccount();
  const galleryId = field(formData, "galleryId") ?? "";
  try {
    await saveGalleryDesign(
      { db: db(), accountId: account.id },
      {
        galleryId,
        themeId: field(formData, "themeId"),
        config: JSON.parse(field(formData, "config") ?? "null"),
      },
    );
  } catch (e) {
    if (e instanceof SyntaxError) {
      redirect(`/dashboard/galleries/${galleryId}/design?error=invalid`);
    }
    redirect(`/dashboard/galleries/${galleryId}/design?error=${errorCode(e)}`);
  }
  revalidatePath(`/dashboard/galleries/${galleryId}`);
  redirect(`/dashboard/galleries/${galleryId}/design?saved=1`);
}

export async function removeLogoAction(formData: FormData) {
  const { account } = await requireAccount();
  const galleryId = field(formData, "galleryId") ?? "";
  await removeLogo({ db: db(), storage: getStorage(), accountId: account.id });
  redirect(`/dashboard/galleries/${galleryId}/design?saved=1`);
}
