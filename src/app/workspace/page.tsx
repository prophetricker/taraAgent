import { redirect } from "next/navigation";

import { Workspace } from "@/components/workspace/workspace";
import {
  ensureConversation,
  ensureDefaultNode,
  getDatabaseHealth,
  getNodeForUser,
  listFragments,
  listMessages,
  listNodes,
  listIdeaRelations
} from "@/db/queries";
import { toFlowGraph } from "@/lib/graph";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({
  searchParams
}: {
  searchParams?: Promise<{ node_id?: string }>;
}) {
  const user = await requireUser();

  if (!user) {
    redirect("/login");
  }

  const databaseHealth = await getDatabaseHealth();
  const params = searchParams ? await searchParams : {};
  const requestedNode = params.node_id
    ? await getNodeForUser({ userId: user.id, nodeId: params.node_id })
    : null;
  const activeNode = requestedNode ?? (await ensureDefaultNode(user.id));
  const conversation = await ensureConversation({
    userId: user.id,
    nodeId: activeNode.id
  });
  const nodes = await listNodes(user.id);
  const relations = await listIdeaRelations(user.id);
  const fragments = await listFragments({
    userId: user.id,
    nodeId: activeNode.id
  });
  const messages = await listMessages({
    userId: user.id,
    conversationId: conversation.id
  });

  return (
    <Workspace
      activeNodeId={activeNode.id}
      conversationId={conversation.id}
      initialGraph={toFlowGraph(nodes)}
      initialRelations={relations}
      initialDatabaseHealth={databaseHealth}
      initialFragments={fragments}
      initialMessages={messages}
      userEmail={user.email ?? "seed user"}
    />
  );
}
