import { createHash, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

function toBytes(input: string): Buffer {
  return Buffer.from(input, "utf8");
}

export function hashPin(pin: string): string {
  return createHash("sha256")
    .update(`${pin}:${env.parentPinPepper}`)
    .digest("hex");
}

export function verifyPin(pin: string, expectedHash: string): boolean {
  const computed = hashPin(pin);
  const left = toBytes(computed);
  const right = toBytes(expectedHash);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
