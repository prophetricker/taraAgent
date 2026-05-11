export type RequiredDatabaseObject =
  | "public.inspiration_nodes"
  | "public.conversations"
  | "public.messages"
  | "public.dandelion_fragments"
  | "public.idea_relations";

export type DatabaseHealth = {
  ok: boolean;
  missingObjects: RequiredDatabaseObject[];
  requiredMigrations: string[];
};

const REQUIRED_OBJECTS: RequiredDatabaseObject[] = [
  "public.inspiration_nodes",
  "public.conversations",
  "public.messages",
  "public.dandelion_fragments",
  "public.idea_relations"
];

const MIGRATION_BY_OBJECT: Record<RequiredDatabaseObject, string> = {
  "public.inspiration_nodes": "supabase/migrations/0001_initial_schema.sql",
  "public.conversations": "supabase/migrations/0001_initial_schema.sql",
  "public.messages": "supabase/migrations/0001_initial_schema.sql",
  "public.dandelion_fragments": "supabase/migrations/0001_initial_schema.sql",
  "public.idea_relations": "supabase/migrations/0002_idea_relations.sql"
};

export function buildDatabaseHealth(
  existingObjects: Partial<Record<RequiredDatabaseObject, boolean>>
): DatabaseHealth {
  const missingObjects = REQUIRED_OBJECTS.filter(
    (objectName) => !existingObjects[objectName]
  );
  const requiredMigrations = [
    ...new Set(missingObjects.map((objectName) => MIGRATION_BY_OBJECT[objectName]))
  ];

  return {
    ok: missingObjects.length === 0,
    missingObjects,
    requiredMigrations
  };
}

export function isMissingRelationTableError(error: unknown) {
  return hasPostgresCode(error, "42P01");
}

export function hasPostgresCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}
