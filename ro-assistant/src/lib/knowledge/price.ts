const SUFFIX_MULTIPLIER: Record<string, number> = {
  "": 1,
  k: 1_000,
  เค: 1_000,
  พัน: 1_000,
  m: 1_000_000,
  เอ็ม: 1_000_000,
  ล้าน: 1_000_000,
  b: 1_000_000_000,
  บี: 1_000_000_000,
  พันล้าน: 1_000_000_000,
};

export interface ParsedPrice {
  value: number;
  normalized: string;
}

function replaceThaiDigits(value: string): string {
  const thaiDigits = "๐๑๒๓๔๕๖๗๘๙";
  return value.replace(/[๐-๙]/g, (digit) =>
    String(thaiDigits.indexOf(digit)),
  );
}

export function parsePriceInput(raw: string): ParsedPrice | null {
  const normalizedInput = replaceThaiDigits(raw)
    .normalize("NFKC")
    .toLocaleLowerCase("th")
    .replace(/[,，_]/g, "")
    .trim();

  const match = normalizedInput.match(
    /^(\d+(?:\.\d+)?)\s*(พันล้าน|ล้าน|พัน|เอ็ม|เค|บี|[kmb])?\s*(?:z|zeny|เซนี)?$/,
  );
  if (!match) return null;

  const amount = Number(match[1]);
  const suffix = match[2] ?? "";
  const multiplier = SUFFIX_MULTIPLIER[suffix];
  const value = Math.round(amount * multiplier);

  if (!Number.isSafeInteger(value) || value <= 0) return null;

  return {
    value,
    normalized: `${value.toLocaleString("en-US")} zeny`,
  };
}

export function formatCompactZeny(value: number): string {
  if (value >= 1_000_000_000) {
    return `${trimDecimal(value / 1_000_000_000)}b`;
  }
  if (value >= 1_000_000) {
    return `${trimDecimal(value / 1_000_000)}m`;
  }
  if (value >= 1_000) {
    return `${trimDecimal(value / 1_000)}k`;
  }
  return value.toLocaleString("en-US");
}

function trimDecimal(value: number): string {
  return value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2).replace(/\.?0+$/, "");
}
