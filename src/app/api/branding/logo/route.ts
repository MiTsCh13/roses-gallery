import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/db";
import { BrandingError, MAX_LOGO_BYTES, setLogo } from "@/lib/branding";
import { getStorage } from "@/lib/storage";

// Plain multipart form post (no Server Action: their body limit is global).
// The account comes from the session; the gallery id only picks the redirect.
export async function POST(request: Request) {
  const accountId = (await auth())?.user?.accountId;
  if (!accountId) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData().catch(() => null);
  const galleryId = z.uuid().safeParse(form?.get("galleryId"));
  if (!form || !galleryId.success)
    return new Response("Bad request", { status: 400 });
  const back = `/dashboard/galleries/${galleryId.data}/design`;
  const redirect = (query: string) =>
    new Response(null, {
      status: 303,
      headers: { Location: `${back}?${query}` },
    });

  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0)
    return redirect("error=logo_invalid");
  if (file.size > MAX_LOGO_BYTES) return redirect("error=logo_too_large");
  try {
    await setLogo(
      { db: db(), storage: getStorage(), accountId },
      Buffer.from(await file.arrayBuffer()),
    );
  } catch (e) {
    if (e instanceof BrandingError) return redirect(`error=${e.code}`);
    throw e;
  }
  return redirect("saved=1");
}
