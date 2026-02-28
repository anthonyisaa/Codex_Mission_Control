export function normalizeAgentName(value: string): string {
  return value
    .trim()
    .replace(/\p{Pd}/gu, "-")
    .replace(/[\u2212\uFE58\uFE63\uFF0D]/g, "-");
}

export function canonicalAgentKey(value: string): string {
  return normalizeAgentName(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-");
}
