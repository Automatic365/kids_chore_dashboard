import { describe, expect, it } from "vitest";

import { hashPin, verifyPin } from "@/lib/server/pin";

describe("PIN hashing", () => {
  it("hashes and verifies correctly", () => {
    const hash = hashPin("1234");
    expect(verifyPin("1234", hash)).toBe(true);
    expect(verifyPin("9999", hash)).toBe(false);
  });
});
