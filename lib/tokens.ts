import { randomBytes } from "crypto";

/**
 * Tokens for the vendor bid portal and the crew job link.
 *
 * The token IS the credential — there is no account behind these pages — so it
 * has to be unguessable. 192 bits, url-safe (docs/08).
 */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}
