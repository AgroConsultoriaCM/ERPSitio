import { randomBytes, createHash } from "node:crypto";

export function gerarRefreshTokenOpaco(): string {
  return randomBytes(48).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
