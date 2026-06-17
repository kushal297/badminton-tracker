const FALLBACK_PIN = "1234";

/**
 * The configured admin PIN. Server-only: read from ADMIN_PIN (NOT NEXT_PUBLIC),
 * so it never ships in the browser bundle. Falls back to "1234" when unset.
 */
export function adminPin(): string {
  const configured = process.env.ADMIN_PIN?.trim();
  return configured && configured.length > 0 ? configured : FALLBACK_PIN;
}

/** True only when `pin` (trimmed) exactly matches the configured admin PIN. */
export function verifyAdminPin(pin: string | null | undefined): boolean {
  if (typeof pin !== "string") return false;
  const entered = pin.trim();
  if (entered.length === 0) return false;
  return entered === adminPin();
}
