/**
 * Garantit qu'une opération prend au moins `minMs` (± `jitterMs` aléatoire).
 *
 * Sert à masquer les différences de temps de traitement révélatrices : que
 * l'e-mail existe ou non, l'inscription et le « mot de passe oublié » doivent
 * répondre en un temps indiscernable (US-1.1 AC4, US-1.3 AC1).
 */
export async function withMinimumDuration<T>(
  fn: () => Promise<T>,
  minMs: number,
  jitterMs = 0,
): Promise<T> {
  const start = performance.now();
  const jitter = jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0;
  const target = minMs + jitter;

  let result: T;
  let error: unknown;
  let threw = false;
  try {
    result = await fn();
  } catch (err) {
    error = err;
    threw = true;
  }

  const elapsed = performance.now() - start;
  const remaining = target - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }

  if (threw) throw error;
  // `result` est assigné si `threw` est faux.
  return result!;
}
