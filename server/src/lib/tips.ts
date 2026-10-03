/**
 * Split a tip pool (agorot) by minutes worked: total × minutes ÷ all minutes,
 * rounded down to whole agorot, with the agorot left over handed out one by
 * one to the largest remainders (earlier rows first on ties). The shares
 * always add up to exactly the total. Mirrored in client/src/lib/tips.ts.
 */
export function splitTips(total: number, minutes: number[]): number[] {
  const sum = minutes.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return minutes.map(() => 0);
  const exact = minutes.map((m) => (total * m) / sum);
  const shares = exact.map(Math.floor);
  const leftover = total - shares.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((value, i) => ({ i, remainder: value - shares[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (let k = 0; k < leftover; k++) shares[byRemainder[k].i]++;
  return shares;
}
