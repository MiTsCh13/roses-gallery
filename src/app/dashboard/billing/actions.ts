"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getBilling } from "@/lib/billing";
import { PLAN_IDS } from "@/lib/plans";
import { requireAccount } from "@/lib/session";

const checkoutSchema = z.object({
  plan: z.enum(PLAN_IDS.filter((id) => id !== "free")),
  interval: z.enum(["month", "year"]),
});

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function startCheckout(formData: FormData) {
  const input = checkoutSchema.parse({
    plan: formData.get("plan"),
    interval: formData.get("interval"),
  });
  const { user, account } = await requireAccount();
  const base = await origin();
  const { url } = await getBilling().createCheckoutSession({
    accountId: account.id,
    email: user.email ?? "",
    customerId: account.stripeCustomerId,
    ...input,
    successUrl: `${base}/dashboard/billing?checkout=success`,
    cancelUrl: `${base}/dashboard/billing?checkout=cancelled`,
  });
  redirect(url);
}

export async function openPortal() {
  const { account } = await requireAccount();
  if (!account.stripeCustomerId) redirect("/dashboard/billing");
  const { url } = await getBilling().createPortalSession({
    customerId: account.stripeCustomerId,
    returnUrl: `${await origin()}/dashboard/billing`,
  });
  redirect(url);
}
