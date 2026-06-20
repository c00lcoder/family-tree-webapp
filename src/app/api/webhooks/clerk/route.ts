import { Webhook } from "svix";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { error, ok } from "@/lib/api";

export const runtime = "nodejs";

interface ClerkEmail {
  id: string;
  email_address: string;
}
interface ClerkExternalAccount {
  provider: string;
  provider_user_id?: string;
}
interface ClerkUserData {
  id: string;
  primary_email_address_id?: string;
  email_addresses?: ClerkEmail[];
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
  external_accounts?: ClerkExternalAccount[];
}
interface ClerkEvent {
  type: string;
  data: ClerkUserData;
}

function primaryEmail(data: ClerkUserData): string {
  const list = data.email_addresses ?? [];
  const primary = list.find((e) => e.id === data.primary_email_address_id);
  return primary?.email_address ?? list[0]?.email_address ?? "";
}

function memorynestId(data: ClerkUserData): string | null {
  const acct = (data.external_accounts ?? []).find((a) =>
    a.provider?.toLowerCase().includes("memorynest"),
  );
  return acct?.provider_user_id ?? null;
}

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return error("Webhook secret not configured", 500);

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return error("Missing svix headers", 400);
  }

  const body = await req.text();
  let event: ClerkEvent;
  try {
    event = new Webhook(secret).verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkEvent;
  } catch {
    return error("Invalid signature", 400);
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const data = event.data;
    const name =
      [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
    const values = {
      clerkId: data.id,
      email: primaryEmail(data),
      name,
      imageUrl: data.image_url ?? null,
      memorynestUserId: memorynestId(data),
      updatedAt: new Date(),
    };
    await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({ target: users.clerkId, set: values });
  } else if (event.type === "user.deleted") {
    await db.delete(users).where(eq(users.clerkId, event.data.id));
  }

  return ok({ received: true });
}
