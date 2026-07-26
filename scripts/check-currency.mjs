/** Runnable check for pkrToUsdCents — fails loud if conversion breaks. */
const PKR_PER_USD = 280;

function pkrToUsdCents(pkr) {
  if (!Number.isFinite(pkr) || pkr < 0) {
    throw new Error("PKR amount must be a non-negative finite number");
  }
  return Math.round((pkr / PKR_PER_USD) * 100);
}

const cases = [
  [0, 0],
  [280, 100],
  [2800, 1000],
  [5000, 1786],
  [1, 0],
  [140, 50],
];

for (const [pkr, expected] of cases) {
  const got = pkrToUsdCents(pkr);
  if (got !== expected) {
    console.error(`FAIL: pkrToUsdCents(${pkr}) = ${got}, expected ${expected}`);
    process.exit(1);
  }
}

let threw = false;
try {
  pkrToUsdCents(-1);
} catch {
  threw = true;
}
if (!threw) {
  console.error("FAIL: expected throw on negative PKR");
  process.exit(1);
}

console.log("ok — currency checks passed");
