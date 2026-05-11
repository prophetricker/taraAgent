import { isMissingRelationTableError } from "./database-health";

export const USER_SAFE_CHAT_STREAM_ERROR = "模型暂时没有回应，请稍后重试。";

export function getUserSafeChatStreamError(error: unknown) {
  void error;

  return USER_SAFE_CHAT_STREAM_ERROR;
}

export function getRelationSaveFailureMessage(error: unknown) {
  if (isMissingRelationTableError(error)) {
    return "关系保存失败：数据库缺少 idea_relations 表，请先在 Supabase SQL Editor 执行 supabase/migrations/0002_idea_relations.sql。";
  }

  return "关系保存失败：请检查网络或数据库状态，刚才的线条修改没有保存。";
}

export function getRelationSaveFailureStatus(error: unknown) {
  return isMissingRelationTableError(error) ? 503 : 500;
}
