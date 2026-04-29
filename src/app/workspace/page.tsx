import { redirect } from "next/navigation";

import { Workspace } from "@/components/workspace/workspace";
import {
  ensureConversation,
  ensureDefaultNode,
  listFragments,
  listMessages,
  listNodes
} from "@/db/queries";
import { toFlowGraph } from "@/lib/graph";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const user = await requireUser();

  if (!user) {
    redirect("/login");
  }

  const activeNode = await ensureDefaultNode(user.id);
  const conversation = await ensureConversation({
    userId: user.id,
    nodeId: activeNode.id
  });
  const nodes = await listNodes(user.id);
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
      initialFragments={fragments}
      initialMessages={messages}
      userEmail={user.email ?? "seed user"}
    />
  );
}
