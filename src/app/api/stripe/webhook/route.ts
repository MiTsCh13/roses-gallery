import { db } from "@/db";
import { applySubscriptionEvent } from "@/lib/billing/apply";
import { getBilling } from "@/lib/billing";
import { InvalidWebhookError } from "@/lib/billing/types";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const event = await getBilling().parseWebhook(
      rawBody,
      request.headers.get("stripe-signature"),
    );
    if (event) await applySubscriptionEvent(db(), event);
    return Response.json({ received: true });
  } catch (error) {
    if (error instanceof InvalidWebhookError) {
      return new Response("Invalid signature", { status: 400 });
    }
    throw error;
  }
}
