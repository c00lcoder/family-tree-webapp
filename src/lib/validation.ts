import { z } from "zod";

export const createTreeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(2000).optional(),
});

export const updateTreeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export const createPersonSchema = z.object({
  givenName: z.string().trim().max(200).optional(),
  surname: z.string().trim().max(200).optional(),
  suffix: z.string().trim().max(20).optional(),
  sex: z.enum(["M", "F", "U"]).default("U"),
  notes: z.string().trim().max(5000).optional(),
});

export const updatePersonSchema = z.object({
  givenName: z.string().trim().max(200).nullable().optional(),
  surname: z.string().trim().max(200).nullable().optional(),
  suffix: z.string().trim().max(20).nullable().optional(),
  sex: z.enum(["M", "F", "U"]).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  avatarMediaId: z.string().uuid().nullable().optional(),
});

// Relationship of the NEW person being added, relative to the existing person.
export const RELATIONSHIPS = [
  "father",
  "mother",
  "spouse",
  "son",
  "daughter",
  "brother",
  "sister",
] as const;

export const addRelativeSchema = z.object({
  relationship: z.enum(RELATIONSHIPS),
  givenName: z.string().trim().max(200).optional(),
  surname: z.string().trim().max(200).optional(),
  suffix: z.string().trim().max(20).optional(),
});

export const uploadUrlSchema = z.object({
  treeId: z.string().uuid(),
  contentType: z
    .string()
    .regex(/^image\/(png|jpe?g|webp|gif|avif)$/, "Unsupported image type"),
  fileName: z.string().trim().max(255).optional(),
  // Used to organize the object into a tidy folder structure in the bucket.
  personId: z.string().uuid().optional(),
  category: z.enum(["avatar", "photo"]).default("photo"),
});

export const createMediaSchema = z.object({
  treeId: z.string().uuid(),
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  personId: z.string().uuid().optional(),
  caption: z.string().trim().max(500).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

export const createStorySchema = z.object({
  title: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1, "Story can't be empty").max(20000),
});
