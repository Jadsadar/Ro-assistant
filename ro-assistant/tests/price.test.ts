import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCompactZeny,
  parsePriceInput,
} from "../src/lib/knowledge/price";

test("parses English and Thai price shorthand", () => {
  assert.equal(parsePriceInput("50m")?.value, 50_000_000);
  assert.equal(parsePriceInput("20 เอ็ม")?.value, 20_000_000);
  assert.equal(parsePriceInput("1.2b")?.value, 1_200_000_000);
  assert.equal(parsePriceInput("๕๐ ล้าน")?.value, 50_000_000);
  assert.equal(parsePriceInput("250,000 zeny")?.value, 250_000);
});

test("rejects missing, zero, negative, and malformed prices", () => {
  assert.equal(parsePriceInput(""), null);
  assert.equal(parsePriceInput("0"), null);
  assert.equal(parsePriceInput("-50m"), null);
  assert.equal(parsePriceInput("ราคา 50m"), null);
  assert.equal(parsePriceInput("50mm"), null);
});

test("formats compact zeny consistently", () => {
  assert.equal(formatCompactZeny(900), "900");
  assert.equal(formatCompactZeny(12_500), "12.5k");
  assert.equal(formatCompactZeny(50_000_000), "50m");
  assert.equal(formatCompactZeny(1_250_000_000), "1.25b");
});
