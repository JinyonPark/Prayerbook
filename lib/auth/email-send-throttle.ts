export const EMAIL_SEND_THROTTLE_MS = 60_000;

const attempts = new Map<string, number>();

function normalizeEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

function pruneExpired(now: number, windowMs: number) {
  for (const [key, at] of attempts) {
    if (now - at >= windowMs) attempts.delete(key);
  }
}

export function consumeEmailSendThrottle(
  email: string,
  now = Date.now(),
  windowMs = EMAIL_SEND_THROTTLE_MS,
): number | null {
  const key = normalizeEmailKey(email);
  pruneExpired(now, windowMs);
  const prev = attempts.get(key);
  if (prev != null && now - prev < windowMs) {
    return Math.max(1, Math.ceil((windowMs - (now - prev)) / 1000));
  }
  attempts.set(key, now);
  return null;
}

export function releaseEmailSendThrottle(email: string) {
  attempts.delete(normalizeEmailKey(email));
}

export function resetEmailSendThrottleForTests() {
  attempts.clear();
}
