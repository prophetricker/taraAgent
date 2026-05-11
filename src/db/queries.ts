import { getSql } from "./client";
import type {
  IdeaRelationKind,
  IdeaRelationRecord,
  InspirationNodeRecord
} from "@/lib/graph";
import {
  buildDatabaseHealth,
  isMissingRelationTableError,
  type DatabaseHealth,
  type RequiredDatabaseObject
} from "@/lib/database-health";

export type DandelionFragmentRecord = {
  id: string;
  nodeId: string | null;
  conversationId: string | null;
  content: string;
  originalContext: string;
  sentimentVibe: string | null;
  createdAt: string;
};

export type ConversationRecord = {
  id: string;
  nodeId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type MessageRecord = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: string;
};

export type StoredIdeaRelationRecord = IdeaRelationRecord & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export class DatabaseMigrationError extends Error {
  constructor(
    message: string,
    readonly health: DatabaseHealth
  ) {
    super(message);
    this.name = "DatabaseMigrationError";
  }
}

export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  const sql = getSql();
  const requiredObjects: RequiredDatabaseObject[] = [
    "public.inspiration_nodes",
    "public.conversations",
    "public.messages",
    "public.dandelion_fragments",
    "public.idea_relations"
  ];
  const rows = await sql`
    select
      object_name,
      to_regclass(object_name) is not null as exists
    from unnest(${requiredObjects}::text[]) as required(object_name)
  `;
  const existingObjects = Object.fromEntries(
    rows.map((row) => [
      row.object_name as RequiredDatabaseObject,
      Boolean(row.exists)
    ])
  ) as Partial<Record<RequiredDatabaseObject, boolean>>;

  return buildDatabaseHealth(existingObjects);
}

export function assertDatabaseReady(health: DatabaseHealth) {
  if (!health.ok) {
    throw new DatabaseMigrationError(
      `Missing database objects: ${health.missingObjects.join(", ")}`,
      health
    );
  }
}

export async function listNodes(userId: string): Promise<InspirationNodeRecord[]> {
  const sql = getSql();
  const rows = await sql`
    select
      id,
      parent_id,
      title,
      content,
      position_x,
      position_y,
      created_at,
      updated_at
    from public.inspiration_nodes
    where user_id = ${userId}
    order by created_at asc
  `;

  return rows.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    content: row.content,
    positionX: row.position_x,
    positionY: row.position_y,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }));
}

export async function ensureDefaultNode(userId: string): Promise<InspirationNodeRecord> {
  const existing = await listNodes(userId);

  if (existing[0]) {
    return existing[0];
  }

  const sql = getSql();
  const rows = await sql`
    insert into public.inspiration_nodes
      (user_id, title, content, position_x, position_y)
    values
      (${userId}, '入口灵感', '从这里开始倾倒、保护和深挖一个想法。', 80, 120)
    returning id, parent_id, title, content, position_x, position_y, created_at, updated_at
  `;
  const row = rows[0];

  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    content: row.content,
    positionX: row.position_x,
    positionY: row.position_y,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function getNodeForUser(input: {
  userId: string;
  nodeId: string;
}): Promise<InspirationNodeRecord | null> {
  const sql = getSql();
  const rows = await sql`
    select id, parent_id, title, content, position_x, position_y, created_at, updated_at
    from public.inspiration_nodes
    where user_id = ${input.userId} and id = ${input.nodeId}
    limit 1
  `;
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    content: row.content,
    positionX: row.position_x,
    positionY: row.position_y,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function createNode(input: {
  userId: string;
  parentId?: string | null;
  title: string;
  content: string;
  positionX?: number;
  positionY?: number;
}): Promise<InspirationNodeRecord> {
  const sql = getSql();
  const rows = input.parentId
    ? await sql`
        with valid_parent as (
          select id
          from public.inspiration_nodes
          where user_id = ${input.userId} and id = ${input.parentId}
        )
        insert into public.inspiration_nodes
          (user_id, parent_id, title, content, position_x, position_y)
        select
          ${input.userId},
          valid_parent.id,
          ${input.title},
          ${input.content},
          ${input.positionX ?? 120},
          ${input.positionY ?? 120}
        from valid_parent
        returning id, parent_id, title, content, position_x, position_y, created_at, updated_at
      `
    : await sql`
        insert into public.inspiration_nodes
          (user_id, parent_id, title, content, position_x, position_y)
        values
          (
            ${input.userId},
            null,
            ${input.title},
            ${input.content},
            ${input.positionX ?? 120},
            ${input.positionY ?? 120}
          )
        returning id, parent_id, title, content, position_x, position_y, created_at, updated_at
      `;
  const row = rows[0];

  if (!row) {
    throw new Error("Parent node not found");
  }

  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    content: row.content,
    positionX: row.position_x,
    positionY: row.position_y,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function upsertNodeByTitle(input: {
  userId: string;
  parentId: string;
  title: string;
  content: string;
  positionX?: number;
  positionY?: number;
}): Promise<InspirationNodeRecord> {
  const sql = getSql();
  const existing = await sql`
    select id, parent_id, title, content, position_x, position_y, created_at, updated_at
    from public.inspiration_nodes
    where user_id = ${input.userId}
      and parent_id = ${input.parentId}
      and title = ${input.title}
    order by created_at asc
    limit 1
  `;

  if (existing[0]) {
    const updated = await updateNode({
      userId: input.userId,
      nodeId: existing[0].id,
      title: input.title,
      content: input.content
    });

    return updated!;
  }

  return createNode(input);
}

export async function updateNode(input: {
  userId: string;
  nodeId: string;
  title: string;
  content: string;
}): Promise<InspirationNodeRecord | null> {
  const sql = getSql();
  const rows = await sql`
    update public.inspiration_nodes
    set title = ${input.title}, content = ${input.content}
    where user_id = ${input.userId} and id = ${input.nodeId}
    returning id, parent_id, title, content, position_x, position_y, created_at, updated_at
  `;
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    content: row.content,
    positionX: row.position_x,
    positionY: row.position_y,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function updateNodePosition(input: {
  userId: string;
  nodeId: string;
  positionX: number;
  positionY: number;
}): Promise<InspirationNodeRecord | null> {
  const sql = getSql();
  const rows = await sql`
    update public.inspiration_nodes
    set position_x = ${Math.round(input.positionX)}, position_y = ${Math.round(input.positionY)}
    where user_id = ${input.userId} and id = ${input.nodeId}
    returning id, parent_id, title, content, position_x, position_y, created_at, updated_at
  `;
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    content: row.content,
    positionX: row.position_x,
    positionY: row.position_y,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function listIdeaRelations(
  userId: string
): Promise<StoredIdeaRelationRecord[]> {
  const sql = getSql();
  let rows;

  try {
    rows = await sql`
      select
        id,
        source_node_id,
        target_node_id,
        relation_kind,
        created_at,
        updated_at
      from public.idea_relations
      where user_id = ${userId}
      order by updated_at desc
    `;
  } catch (error) {
    if (isMissingRelationError(error)) {
      return [];
    }

    throw error;
  }

  return rows.map((row) => ({
    id: row.id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    relationKind: row.relation_kind as IdeaRelationKind,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }));
}

export async function upsertIdeaRelation(input: {
  userId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationKind: IdeaRelationKind;
}): Promise<StoredIdeaRelationRecord | null> {
  const sql = getSql();
  const rows = await sql`
    with valid_nodes as (
      select
        source.id as source_node_id,
        target.id as target_node_id
      from public.inspiration_nodes source
      join public.inspiration_nodes target
        on target.id = ${input.targetNodeId}
      where source.id = ${input.sourceNodeId}
        and source.user_id = ${input.userId}
        and target.user_id = ${input.userId}
        and source.id <> target.id
    )
    insert into public.idea_relations (
      user_id,
      source_node_id,
      target_node_id,
      relation_kind
    )
    select
      ${input.userId},
      valid_nodes.source_node_id,
      valid_nodes.target_node_id,
      ${input.relationKind}
    from valid_nodes
    on conflict (user_id, source_node_id, target_node_id)
    do update set relation_kind = excluded.relation_kind
    returning id, source_node_id, target_node_id, relation_kind, created_at, updated_at
  `;
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    relationKind: row.relation_kind as IdeaRelationKind,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function isMissingRelationError(error: unknown) {
  return isMissingRelationTableError(error);
}

export async function ensureConversation(input: {
  userId: string;
  nodeId: string;
}): Promise<ConversationRecord> {
  const sql = getSql();
  const existing = await sql`
    select
      conversations.id,
      conversations.node_id,
      conversations.title,
      conversations.created_at,
      conversations.updated_at
    from public.conversations
    join public.inspiration_nodes
      on inspiration_nodes.id = conversations.node_id
     and inspiration_nodes.user_id = ${input.userId}
    where conversations.user_id = ${input.userId}
      and conversations.node_id = ${input.nodeId}
    order by conversations.created_at asc
    limit 1
  `;

  if (existing[0]) {
    return {
      id: existing[0].id,
      nodeId: existing[0].node_id,
      title: existing[0].title,
      createdAt: existing[0].created_at.toISOString(),
      updatedAt: existing[0].updated_at.toISOString()
    };
  }

  const rows = await sql`
    with valid_node as (
      select id
      from public.inspiration_nodes
      where user_id = ${input.userId} and id = ${input.nodeId}
    )
    insert into public.conversations (user_id, node_id, title)
    select ${input.userId}, valid_node.id, '灵感对谈'
    from valid_node
    returning id, node_id, title, created_at, updated_at
  `;
  const row = rows[0];

  if (!row) {
    throw new Error("Node not found");
  }

  return {
    id: row.id,
    nodeId: row.node_id,
    title: row.title,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function getConversationForUser(input: {
  userId: string;
  conversationId: string;
  nodeId?: string | null;
}): Promise<ConversationRecord | null> {
  const sql = getSql();
  const rows = await sql`
    select id, node_id, title, created_at, updated_at
    from public.conversations
    where user_id = ${input.userId}
      and id = ${input.conversationId}
      and (${input.nodeId ?? null}::uuid is null or node_id = ${input.nodeId ?? null})
    limit 1
  `;
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    nodeId: row.node_id,
    title: row.title,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function createMessage(input: {
  userId: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata?: Record<string, unknown>;
}) {
  const sql = getSql();
  await sql`
    with valid_conversation as (
      select id
      from public.conversations
      where user_id = ${input.userId} and id = ${input.conversationId}
    )
    insert into public.messages (user_id, conversation_id, role, content, metadata)
    select
      ${input.userId},
      valid_conversation.id,
      ${input.role},
      ${input.content},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    from valid_conversation
  `;
}

export async function listMessages(input: {
  userId: string;
  conversationId: string;
}): Promise<MessageRecord[]> {
  const sql = getSql();
  const rows = await sql`
    select id, role, content, created_at
    from public.messages
    where user_id = ${input.userId} and conversation_id = ${input.conversationId}
    order by created_at asc
  `;

  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at.toISOString()
  }));
}

export async function listFragments(input: {
  userId: string;
  nodeId?: string | null;
}): Promise<DandelionFragmentRecord[]> {
  const sql = getSql();
  const rows = input.nodeId
    ? await sql`
        select id, node_id, conversation_id, content, original_context, sentiment_vibe, created_at
        from public.dandelion_fragments
        where user_id = ${input.userId} and node_id = ${input.nodeId}
        order by created_at desc
      `
    : await sql`
        select id, node_id, conversation_id, content, original_context, sentiment_vibe, created_at
        from public.dandelion_fragments
        where user_id = ${input.userId}
        order by created_at desc
      `;

  return rows.map((row) => ({
    id: row.id,
    nodeId: row.node_id,
    conversationId: row.conversation_id,
    content: row.content,
    originalContext: row.original_context,
    sentimentVibe: row.sentiment_vibe,
    createdAt: row.created_at.toISOString()
  }));
}

export async function createFragment(input: {
  userId: string;
  nodeId?: string | null;
  conversationId?: string | null;
  content: string;
  originalContext: string;
  sentimentVibe?: string | null;
}): Promise<DandelionFragmentRecord> {
  const sql = getSql();
  const rows = await sql`
    with valid_input as (
      select
        ${input.userId}::uuid as user_id,
        ${input.nodeId ?? null}::uuid as node_id,
        ${input.conversationId ?? null}::uuid as conversation_id,
        ${input.content}::text as content,
        ${input.originalContext}::text as original_context,
        ${input.sentimentVibe ?? null}::text as sentiment_vibe
      where
        (
          ${input.nodeId ?? null}::uuid is null
          or exists (
            select 1
            from public.inspiration_nodes
            where user_id = ${input.userId} and id = ${input.nodeId ?? null}
          )
        )
        and (
          ${input.conversationId ?? null}::uuid is null
          or exists (
            select 1
            from public.conversations
            where user_id = ${input.userId}
              and id = ${input.conversationId ?? null}
              and (
                ${input.nodeId ?? null}::uuid is null
                or node_id = ${input.nodeId ?? null}
              )
          )
        )
    )
    insert into public.dandelion_fragments
      (user_id, node_id, conversation_id, content, original_context, sentiment_vibe)
    select
      user_id,
      node_id,
      conversation_id,
      content,
      original_context,
      sentiment_vibe
    from valid_input
    returning id, node_id, conversation_id, content, original_context, sentiment_vibe, created_at
  `;
  const row = rows[0];

  if (!row) {
    throw new Error("Fragment target not found");
  }

  return {
    id: row.id,
    nodeId: row.node_id,
    conversationId: row.conversation_id,
    content: row.content,
    originalContext: row.original_context,
    sentimentVibe: row.sentiment_vibe,
    createdAt: row.created_at.toISOString()
  };
}
