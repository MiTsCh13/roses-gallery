"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  createGallery,
  GalleryError,
  setGalleryCover,
  updateGallery,
} from "@/lib/galleries";
import { BrandingError, removeLogo } from "@/lib/branding";
import { DeliveryError, sendDeliveryMail } from "@/lib/delivery-mail";
import { serverEnv } from "@/lib/env";
import { getMailer } from "@/lib/mailer";
import { getRateLimiter } from "@/lib/rate-limit";
import { setGalleryPassword } from "@/lib/gallery-access";
import { deleteMedia } from "@/lib/library";
import { getStorage } from "@/lib/storage";
import { getVideoProvider } from "@/lib/video";
import { saveGalleryDesign } from "@/lib/gallery-design";
import { PlanLimitError } from "@/lib/plans";
import { saveWatermarkConfig } from "@/lib/watermark";
import { requireAccount } from "@/lib/session";
import {
  addToGallery,
  removeFromGallery,
  reorderGalleryMedia,
} from "@/lib/library";
import { z, ZodError } from "zod";

function errorCode(e: unknown): string {
  if (e instanceof PlanLimitError) return e.code;
  if (e instanceof GalleryError) return e.code;
  if (e instanceof BrandingError) return e.code;
  if (e instanceof DeliveryError) return e.code;
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

export async function setGalleryCoverAction(
  galleryId: string,
  mediaId: string | null,
) {
  const { account } = await requireAccount();
  const gid = z.uuid().parse(galleryId);
  await setGalleryCover(
    { db: db(), accountId: account.id },
    gid,
    mediaId === null ? null : z.uuid().parse(mediaId),
  );
  revalidatePath(`/dashboard/galleries/${gid}`);
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
      redirect(`/dashboard/galleries/${galleryId}?error=invalid#design-block`);
    }
    redirect(
      `/dashboard/galleries/${galleryId}?error=${errorCode(e)}#design-block`,
    );
  }
  revalidatePath(`/dashboard/galleries/${galleryId}`);
  redirect(`/dashboard/galleries/${galleryId}?saved=1#design-block`);
}

export async function removeLogoAction(formData: FormData) {
  const { account } = await requireAccount();
  const galleryId = field(formData, "galleryId") ?? "";
  await removeLogo({ db: db(), storage: getStorage(), accountId: account.id });
  redirect(`/dashboard/galleries/${galleryId}?saved=1#design-block`);
}

export async function sendDeliveryMailAction(formData: FormData) {
  const { account } = await requireAccount();
  const galleryId = field(formData, "galleryId") ?? "";
  const env = serverEnv();
  let result;
  try {
    const limit = await getRateLimiter(env.REDIS_URL).hit(
      `delivery:${account.id}`,
      60,
      60 * 60,
    );
    if (!limit.allowed) {
      redirect(`/dashboard/galleries/${galleryId}?error=rate_limited`);
    }
    result = await sendDeliveryMail(
      {
        db: db(),
        mailer: getMailer(),
        baseUrl: env.AUTH_URL ?? "http://localhost:3000",
        accountId: account.id,
      },
      {
        galleryId,
        subject: field(formData, "subject"),
        body: field(formData, "body"),
        recipients: field(formData, "recipients") ?? "",
      },
    );
  } catch (e) {
    redirect(`/dashboard/galleries/${galleryId}?error=${errorCode(e)}`);
  }
  revalidatePath(`/dashboard/galleries/${galleryId}`);
  redirect(
    `/dashboard/galleries/${galleryId}?sent=${result.sent}&failed=${result.failed}`,
  );
}

const mediaIds = z.array(z.uuid()).min(1).max(500);

export async function addGalleryMediaAction(galleryId: string, ids: string[]) {
  const { account } = await requireAccount();
  const d = { db: db(), accountId: account.id };
  const gid = z.uuid().parse(galleryId);
  for (const mediaId of mediaIds.parse(ids)) {
    await addToGallery(d, gid, mediaId);
  }
  revalidatePath(`/dashboard/galleries/${gid}`);
}

export async function removeGalleryMediaAction(
  galleryId: string,
  ids: string[],
) {
  const { account } = await requireAccount();
  const d = { db: db(), accountId: account.id };
  const gid = z.uuid().parse(galleryId);
  for (const mediaId of mediaIds.parse(ids)) {
    await removeFromGallery(d, gid, mediaId);
  }
  revalidatePath(`/dashboard/galleries/${gid}`);
}

export async function reorderGalleryMediaAction(
  galleryId: string,
  ids: string[],
) {
  const { account } = await requireAccount();
  const d = { db: db(), accountId: account.id };
  const gid = z.uuid().parse(galleryId);
  await reorderGalleryMedia(d, gid, mediaIds.parse(ids));
  revalidatePath(`/dashboard/galleries/${gid}`);
}

/** Deletes the marked media from the library for good (also from all galleries). */
export async function deleteGalleryMediaAction(
  galleryId: string,
  ids: string[],
) {
  const { account } = await requireAccount();
  const d = { db: db(), accountId: account.id };
  const gid = z.uuid().parse(galleryId);
  await deleteMedia(
    { ...d, storage: getStorage(), video: getVideoProvider() },
    mediaIds.parse(ids),
  );
  revalidatePath(`/dashboard/galleries/${gid}`);
  revalidatePath("/dashboard/library");
}
