export function getAuthRedirectOrigin({
  requestOrigin,
  siteUrl
}: {
  requestOrigin: string | null;
  siteUrl?: string;
}) {
  const origin = requestOrigin || siteUrl || "http://localhost:3000";

  return origin.replace(/\/+$/, "");
}
