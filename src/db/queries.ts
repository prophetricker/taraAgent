import { getSql } from "./client";
import type { InspirationNodeRecord } from "@/lib/graph";

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

export async function createNode(input: {
  userId: string;
  parentId?: string | null;
  title: string;
  content: string;
  positionX?: number;
  positionY?: number;
}): Promise<InspirationNodeRecord> {
  const sql = getSql();
  const rows = await sql`
    insert into public.inspiration_nodes
      (user_id, parent_id, title, content, position_x, position_y)
    values
      (
        ${input.userId},
        ${input.parentId ?? null},
        ${input.title},
        ${input.content},
        ${input.positionX ?? 120},
        ${input.positionY ?? 120}
      )
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

export async function ensureConversation(input: {
  userId: string;
  nodeId: string;
}): Promise<ConversationRecord> {
  const sql = getSql();
  const existing = await sql`
    select id, node_id, title, created_at, updated_at
    from public.conversations
    where user_id = ${input.userId} and node_id = ${input.nodeId}
    order by created_at asc
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
    insert into public.conversations (user_id, node_id, title)
    values (${input.userId}, ${input.nodeId}, '灵感对谈')
    returning id, node_id, title, created_at, updated_at
  `;
  const row = rows[0];

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
    insert into public.messages (user_id, conversation_id, role, content, metadata)
    values (
      ${input.userId},
      ${input.conversationId},
      ${input.role},
      ${input.content},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
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
    insert into public.dandelion_fragments
      (user_id, node_id, conversation_id, content, original_context, sentiment_vibe)
    values
      (
        ${input.userId},
        ${input.nodeId ?? null},
        ${input.conversationId ?? null},
        ${input.content},
        ${input.originalContext},
        ${input.sentimentVibe ?? null}
      )
    returning id, node_id, conversation_id, content, original_context, sentiment_vibe, created_at
  `;
  const row = rows[0];

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
