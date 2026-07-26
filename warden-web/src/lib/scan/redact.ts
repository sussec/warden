/**
 * Defense-in-depth: never render credentials that may have been stored
 * on historical scan jobs before API-side redaction.
 */
export function redactSecrets(text: string | null | undefined): string {
  if (!text) return "";
  let s = text;
  // https://user:pass@host → https://user:***@host
  s = s.replace(/(https?:\/\/)([^/\s:@]+):([^/\s@]+)@/gi, "$1$2:***@");
  // GitHub PATs
  s = s.replace(/\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{10,}\b/gi, "$1_***");
  // GitLab PATs
  s = s.replace(/\bglpat-[A-Za-z0-9\-_]{10,}\b/gi, "glpat-***");
  return s;
}
