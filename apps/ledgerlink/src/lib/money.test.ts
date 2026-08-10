import { describe, it, expect } from "vitest";
import { toCentavos, fromCentavos, toDecimalString, formatMoney, distribute, sumCentavos } from "./money";

describe("money parsing (no floating point)", () => {
  it("parses the UnionBank amounts exactly", () => {
    expect(toCentavos("904160.70")).toBe(90416070);
    expect(toCentavos("23658.87")).toBe(2365887);
    expect(toCentavos(23658.87)).toBe(2365887);
    expect(toCentavos("14624.80")).toBe(1462480);
    expect(toCentavos("9034.07")).toBe(903407);
  });

  it("rounds half up on the 3rd decimal", () => {
    expect(toCentavos("1.005")).toBe(101);
    expect(toCentavos("1.004")).toBe(100);
    expect(toCentavos("0.1")).toBe(10);
    expect(toCentavos("")).toBe(0);
    expect(toCentavos(null)).toBe(0);
  });

  it("round-trips and formats", () => {
    expect(fromCentavos(2365887)).toBe(23658.87);
    expect(toDecimalString(2365887)).toBe("23658.87");
    expect(toDecimalString(90416070)).toBe("904160.70");
    expect(formatMoney(2365887, "PHP")).toBe("₱23,658.87");
    expect(formatMoney(-2365887, "PHP")).toBe("-₱23,658.87");
    expect(formatMoney(90416070)).toBe("₱904,160.70");
  });
});

describe("distribute reconciles to the whole", () => {
  it("splits evenly and absorbs remainder", () => {
    const parts = distribute(100, 3); // 1.00 across 3
    expect(sumCentavos(parts)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
  });
  it("handles a large principal", () => {
    const parts = distribute(90416070, 60);
    expect(sumCentavos(parts)).toBe(90416070);
  });
});
