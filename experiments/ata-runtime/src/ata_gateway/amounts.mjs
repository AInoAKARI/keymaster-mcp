export const JPY_MICROS_PER_YEN = 1_000_000n;
export const DEFAULT_MICROPAYMENT_JPY_MICROS = 10_000n; // ¥0.01

export function parseJpyMicros(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  throw new Error('jpyMicros must be a non-negative integer string');
}

export function formatYen(jpyMicros) {
  const micros = parseJpyMicros(jpyMicros);
  const yen = micros / JPY_MICROS_PER_YEN;
  const fraction = (micros % JPY_MICROS_PER_YEN).toString().padStart(6, '0').replace(/0+$/, '');
  return fraction ? `${yen}.${fraction}` : `${yen}`;
}
