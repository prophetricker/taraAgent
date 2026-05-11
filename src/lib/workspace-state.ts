import type { DatabaseHealth } from "./database-health";
import type { IdeaRelationRecord } from "./graph";

export function getInitialCanvasNotice(databaseHealth: DatabaseHealth) {
  if (databaseHealth.ok) {
    return null;
  }

  return `数据库迁移未完成：请执行 ${databaseHealth.requiredMigrations.join(", ")}`;
}

export function applyRelationOptimisticUpdate(
  currentRelations: IdeaRelationRecord[],
  nextRelation: IdeaRelationRecord
) {
  return [
    ...currentRelations.filter(
      (relation) =>
        relation.sourceNodeId !== nextRelation.sourceNodeId ||
        relation.targetNodeId !== nextRelation.targetNodeId
    ),
    nextRelation
  ];
}

export function applyRelationSaveFailure(
  previousRelations: IdeaRelationRecord[]
) {
  return previousRelations;
}
