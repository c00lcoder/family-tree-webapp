import { handle, ok } from "@/lib/api";
import { requireDbUser } from "@/lib/auth";
import { createTree, listTreesForUser } from "@/lib/db/queries";
import { createTreeSchema } from "@/lib/validation";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await requireDbUser();
  const trees = await listTreesForUser(user.id);
  return ok(trees);
});

export const POST = handle(async (req: Request) => {
  const user = await requireDbUser();
  const body = createTreeSchema.parse(await req.json());
  const tree = await createTree({ ...body, ownerId: user.id });
  return ok(tree, { status: 201 });
});
