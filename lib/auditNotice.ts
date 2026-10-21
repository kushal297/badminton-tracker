/**
 * When a game write commits but its game_events row fails, the app still goes to the
 * session page (the change happened; keeping the form open would invite a duplicate) and
 * flags the failure in the URL so the session page can tell the user.
 */
export type AuditNotice = "audit" | "audit-delete";

const MESSAGES: Record<AuditNotice, string> = {
  audit: "Saved, but the audit log entry failed. Tell the admin.",
  "audit-delete": "Deleted, but the audit log entry failed. Tell the admin.",
};

export function auditRedirectPath(playedOn: string, notice: AuditNotice | null): string {
  return `/sessions/${playedOn}${notice ? `?notice=${notice}` : ""}`;
}

/** Only the exact notice values show a banner; any other text in the URL is ignored. */
export function auditNoticeMessage(value: unknown): string | null {
  return value === "audit" || value === "audit-delete" ? MESSAGES[value] : null;
}
