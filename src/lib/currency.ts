/** Fixed sandbox conversion rate: 280 PKR = $1 USD. */
export const PKR_PER_USD = 280;

/**
 * Convert a PKR amount to USD cents for Paddle (lowest denomination).
 * e.g. 2800 PKR -> 1000 cents ($10.00)
 */
export function pkrToUsdCents(pkr: number): number {
  if (!Number.isFinite(pkr) || pkr < 0) {
    throw new Error("PKR amount must be a non-negative finite number");
  }
  return Math.round((pkr / PKR_PER_USD) * 100);
}

/** Format USD cents as a display string, e.g. 1786 -> "$17.86". */
export function formatUsdCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
