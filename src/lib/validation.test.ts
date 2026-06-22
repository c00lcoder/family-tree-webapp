import { describe, it, expect } from "vitest";
import {
  createTreeSchema,
  createPersonSchema,
  updatePersonSchema,
  addRelativeSchema,
  uploadUrlSchema,
  addMemberSchema,
} from "./validation";

describe("validation schemas", () => {
  it("createTreeSchema requires a non-empty name and trims it", () => {
    expect(createTreeSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createTreeSchema.safeParse({ name: "   " }).success).toBe(false);
    const ok = createTreeSchema.parse({ name: "  The Does  " });
    expect(ok.name).toBe("The Does");
  });

  it("createPersonSchema defaults sex to U", () => {
    expect(createPersonSchema.parse({}).sex).toBe("U");
    expect(createPersonSchema.safeParse({ sex: "X" }).success).toBe(false);
  });

  it("updatePersonSchema allows clearing fields with null", () => {
    const r = updatePersonSchema.parse({ suffix: null, avatarMediaId: null });
    expect(r.suffix).toBeNull();
    expect(r.avatarMediaId).toBeNull();
  });

  it("addRelativeSchema only accepts known relationships", () => {
    expect(addRelativeSchema.safeParse({ relationship: "father" }).success).toBe(
      true,
    );
    expect(addRelativeSchema.safeParse({ relationship: "cousin" }).success).toBe(
      false,
    );
  });

  it("uploadUrlSchema rejects non-image types and defaults category", () => {
    const treeId = "11111111-1111-4111-8111-111111111111";
    expect(
      uploadUrlSchema.safeParse({ treeId, contentType: "application/pdf" })
        .success,
    ).toBe(false);
    const ok = uploadUrlSchema.parse({ treeId, contentType: "image/png" });
    expect(ok.category).toBe("photo");
  });

  it("addMemberSchema validates email and role", () => {
    expect(addMemberSchema.safeParse({ email: "nope" }).success).toBe(false);
    expect(addMemberSchema.parse({ email: "a@b.com" }).role).toBe("member");
    expect(
      addMemberSchema.safeParse({ email: "a@b.com", role: "owner" }).success,
    ).toBe(false);
  });
});
