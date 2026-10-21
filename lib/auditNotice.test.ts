import { describe, expect, it } from "vitest";
import { auditNoticeMessage, auditRedirectPath } from "@/lib/auditNotice";

describe("auditRedirectPath", () => {
  it("is the plain session path when the audit entry was written", () => {
    expect(auditRedirectPath("2026-10-21", null)).toBe("/sessions/2026-10-21");
  });

  it("adds ?notice=audit when a save's audit entry failed", () => {
    expect(auditRedirectPath("2026-10-21", "audit")).toBe("/sessions/2026-10-21?notice=audit");
  });

  it("adds ?notice=audit-delete when a delete's audit entry failed", () => {
    expect(auditRedirectPath("2026-10-21", "audit-delete")).toBe("/sessions/2026-10-21?notice=audit-delete");
  });
});

describe("auditNoticeMessage", () => {
  it("gives the save message for the audit notice value", () => {
    expect(auditNoticeMessage("audit")).toBe("Saved, but the audit log entry failed. Tell the admin.");
  });

  it("gives the delete message for the audit-delete notice value", () => {
    expect(auditNoticeMessage("audit-delete")).toBe("Deleted, but the audit log entry failed. Tell the admin.");
  });

  it("is null when the param is missing", () => {
    expect(auditNoticeMessage(undefined)).toBeNull();
  });

  it("is null for any other text, so nothing from the URL is shown", () => {
    expect(auditNoticeMessage("<b>hi</b>")).toBeNull();
    expect(auditNoticeMessage("AUDIT")).toBeNull();
    expect(auditNoticeMessage("toString")).toBeNull();
  });

  it("is null for a repeated param (string array)", () => {
    expect(auditNoticeMessage(["audit", "audit"])).toBeNull();
  });
});
