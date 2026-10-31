"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import {
  createFolder,
  deleteFolder,
  deleteMedia,
  moveMedia,
  renameFolder,
} from "@/lib/library";
import { requireAccount } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { getVideoProvider } from "@/lib/video";

const id = z.uuid();
const ids = z.array(z.uuid()).min(1).max(500);

async function deps() {
  const { account } = await requireAccount();
  return { db: db(), accountId: account.id };
}

export async function createFolderAction(
  name: string,
  parentId: string | null,
) {
  await createFolder(await deps(), {
    name,
    parentId: parentId ? id.parse(parentId) : null,
  });
  revalidatePath("/dashboard/library");
}

export async function renameFolderAction(folderId: string, name: string) {
  await renameFolder(await deps(), id.parse(folderId), name);
  revalidatePath("/dashboard/library");
}

export async function deleteFolderAction(folderId: string) {
  await deleteFolder(await deps(), id.parse(folderId));
  revalidatePath("/dashboard/library");
}

export async function moveMediaAction(
  mediaIds: string[],
  folderId: string | null,
) {
  await moveMedia(
    await deps(),
    ids.parse(mediaIds),
    folderId ? id.parse(folderId) : null,
  );
  revalidatePath("/dashboard/library");
}

export async function deleteMediaAction(mediaIds: string[]) {
  await deleteMedia(
    { ...(await deps()), storage: getStorage(), video: getVideoProvider() },
    ids.parse(mediaIds),
  );
  revalidatePath("/dashboard/library");
}
