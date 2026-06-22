import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const sexEnum = pgEnum("sex", ["M", "F", "U"]);
export const memberRoleEnum = pgEnum("member_role", ["admin", "member"]);
export const memberStatusEnum = pgEnum("member_status", [
  "active",
  "invited",
]);
// Event subjects can be a person (birth/death) or a family (marriage/divorce).
export const eventSubjectEnum = pgEnum("event_subject", ["person", "family"]);

// ---------------------------------------------------------------------------
// Users — mirror of Clerk users, synced via webhook.
// ---------------------------------------------------------------------------
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: text("clerk_id").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    imageUrl: text("image_url"),
    // Set when the user signed in through the MemoryNest OIDC connection.
    memorynestUserId: text("memorynest_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_clerk_id_idx").on(t.clerkId),
    index("users_memorynest_idx").on(t.memorynestUserId),
  ],
);

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------
export const trees = pgTable(
  "trees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Future seam: when nest->tree sync lands, link back to the memorynest nest.
    sourceNestId: text("source_nest_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("trees_owner_idx").on(t.ownerId)],
);

// Sharing model mirrors a memorynest nest: members + (app-enforced) up to 2 admins.
export const treeMembers = pgTable(
  "tree_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("member"),
    status: memberStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("tree_members_unique_idx").on(t.treeId, t.userId),
    index("tree_members_user_idx").on(t.userId),
  ],
);

// Pending invitations by email — claimed into a membership when that email signs
// up (via the Clerk webhook). Lets you invite relatives before they have accounts.
export const treeInvites = pgTable(
  "tree_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: memberRoleEnum("role").notNull().default("member"),
    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("tree_invites_unique_idx").on(t.treeId, t.email),
    index("tree_invites_email_idx").on(t.email),
  ],
);

// ---------------------------------------------------------------------------
// Media (Cloudflare R2 / S3-compatible objects)
// ---------------------------------------------------------------------------
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    // Optional association with a specific person.
    personId: uuid("person_id"),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    caption: text("caption"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("media_tree_idx").on(t.treeId),
    index("media_person_idx").on(t.personId),
  ],
);

// ---------------------------------------------------------------------------
// Persons (GEDCOM INDI)
// ---------------------------------------------------------------------------
export const persons = pgTable(
  "persons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    // Original GEDCOM xref (e.g. "@I1@") to wire up relationships on import.
    gedcomXref: text("gedcom_xref"),
    givenName: text("given_name"),
    surname: text("surname"),
    // Name suffix such as Jr, Sr, III.
    suffix: text("suffix"),
    sex: sexEnum("sex").notNull().default("U"),
    notes: text("notes"),
    avatarMediaId: uuid("avatar_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("persons_tree_idx").on(t.treeId),
    index("persons_xref_idx").on(t.treeId, t.gedcomXref),
  ],
);

// ---------------------------------------------------------------------------
// Families (GEDCOM FAM) — a union of up to two partners.
// ---------------------------------------------------------------------------
export const families = pgTable(
  "families",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    gedcomXref: text("gedcom_xref"),
    partner1Id: uuid("partner1_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    partner2Id: uuid("partner2_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("families_tree_idx").on(t.treeId)],
);

export const familyChildren = pgTable(
  "family_children",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    childId: uuid("child_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("family_children_unique_idx").on(t.familyId, t.childId),
    index("family_children_child_idx").on(t.childId),
  ],
);

// ---------------------------------------------------------------------------
// Events — birth/death (person) or marriage/divorce (family).
// ---------------------------------------------------------------------------
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    subject: eventSubjectEnum("subject").notNull(),
    personId: uuid("person_id").references(() => persons.id, {
      onDelete: "cascade",
    }),
    familyId: uuid("family_id").references(() => families.id, {
      onDelete: "cascade",
    }),
    type: text("type").notNull(), // BIRT, DEAT, MARR, DIV, ...
    dateRaw: text("date_raw"),
    dateParsed: timestamp("date_parsed", { withTimezone: true }),
    place: text("place"),
  },
  (t) => [
    index("events_person_idx").on(t.personId),
    index("events_family_idx").on(t.familyId),
  ],
);

// ---------------------------------------------------------------------------
// Sources & citations (GEDCOM SOUR records + references)
// ---------------------------------------------------------------------------
export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    gedcomXref: text("gedcom_xref"),
    title: text("title"),
    author: text("author"),
    publication: text("publication"),
    repositoryName: text("repository_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("sources_tree_idx").on(t.treeId)],
);

// A citation links a source to a person (optionally tagged with the event it
// supports, e.g. BIRT) with a page reference.
export const citations = pgTable(
  "citations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    eventType: text("event_type"),
    page: text("page"),
  },
  (t) => [
    index("citations_person_idx").on(t.personId),
    index("citations_source_idx").on(t.sourceId),
  ],
);

// ---------------------------------------------------------------------------
// Stories — memories family members attach to a person's profile
// ---------------------------------------------------------------------------
export const stories = pgTable(
  "stories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => trees.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text("title"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("stories_person_idx").on(t.personId)],
);

// ---------------------------------------------------------------------------
// Relations (Drizzle query helpers)
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  trees: many(trees),
  memberships: many(treeMembers),
}));

export const treesRelations = relations(trees, ({ one, many }) => ({
  owner: one(users, { fields: [trees.ownerId], references: [users.id] }),
  members: many(treeMembers),
  persons: many(persons),
  families: many(families),
}));

export const personsRelations = relations(persons, ({ one, many }) => ({
  tree: one(trees, { fields: [persons.treeId], references: [trees.id] }),
  avatar: one(media, {
    fields: [persons.avatarMediaId],
    references: [media.id],
  }),
  events: many(events),
}));

export const familiesRelations = relations(families, ({ one, many }) => ({
  tree: one(trees, { fields: [families.treeId], references: [trees.id] }),
  partner1: one(persons, {
    fields: [families.partner1Id],
    references: [persons.id],
  }),
  partner2: one(persons, {
    fields: [families.partner2Id],
    references: [persons.id],
  }),
  children: many(familyChildren),
}));

export const familyChildrenRelations = relations(familyChildren, ({ one }) => ({
  family: one(families, {
    fields: [familyChildren.familyId],
    references: [families.id],
  }),
  child: one(persons, {
    fields: [familyChildren.childId],
    references: [persons.id],
  }),
}));
