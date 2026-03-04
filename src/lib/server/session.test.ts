import { describe, expect, it } from "vitest";

import { issueParentSession, verifyParentSession } from "@/lib/server/session";

describe("parent session", () => {
  it("issues and verifies signed tokens", () => {
    const token = issueParentSession();
    const verified = verifyParentSession(token);
    expect(verified?.role).toBe("parent");
  });

  it("rejects tampered tokens", () => {
    const token = issueParentSession();
    const tampered = `${token}abc`;
    expect(verifyParentSession(tampered)).toBeNull();
  });
});
