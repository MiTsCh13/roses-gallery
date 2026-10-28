"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  createGallery,
  createSet,
  GalleryError,
  updateGallery,
} from "@/lib/galleries";
import { PlanLimitError } from "@/lib/plans";
import { requireAccount } from "@/lib/session";
import { ZodError } from "zod";

function errorCode(e: unknown): string {
  if (e instanceof PlanLimitError) return e.code;
  if (e instanceof GalleryError) return e.code;
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
      },
    );
  } catch (e) {
    redirect(`/dashboard/galleries/${galleryId}?error=${errorCode(e)}`);
  }
  revalidatePath("/dashboard/galleries");
  redirect(`/dashboard/galleries/${galleryId}?saved=1`);
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
