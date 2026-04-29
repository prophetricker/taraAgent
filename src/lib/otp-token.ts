export function normalizeEmailOtpToken(value: string) {
  const token = value.replace(/\D/g, "");

  return token.length === 6 || token.length === 8 ? token : null;
}
