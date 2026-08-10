import { describe, it, expect } from "vitest";
import { computeCoverage } from "./coverage";

const UB = 2365887; // ₱23,658.87 UnionBank monthly

describe("linked-obligation coverage", () => {
  it("is COVERED when sister pays more than UnionBank is due", () => {
    const c = computeCoverage({ incomingExpected: 2500000, outgoingDue: UB }); // ₱25,000
    expect(c.status).toBe("covered");
    expect(c.coveragePct).toBeCloseTo(105.67, 1);
    expect(c.shortfall).toBe(0);
  });

  it("is PARTIALLY COVERED with a shortfall when sister pays less", () => {
    const c = computeCoverage({ incomingExpected: 2000000, outgoingDue: UB }); // ₱20,000
    expect(c.status).toBe("partially_covered");
    expect(c.coveragePct).toBeCloseTo(84.53, 1);
    expect(c.shortfall).toBe(365887); // ₱3,658.87
  });

  it("is COVERED at exactly 100%", () => {
    const c = computeCoverage({ incomingExpected: UB, outgoingDue: UB });
    expect(c.status).toBe("covered");
    expect(c.coveragePct).toBe(100);
    expect(c.shortfall).toBe(0);
  });

  it("is UNDERFUNDED when nothing is coming in", () => {
    const c = computeCoverage({ incomingExpected: 0, outgoingDue: UB });
    expect(c.status).toBe("underfunded");
    expect(c.shortfall).toBe(UB);
  });

  it("is COVERED (vacuously) when nothing is due", () => {
    const c = computeCoverage({ incomingExpected: 0, outgoingDue: 0 });
    expect(c.status).toBe("covered");
    expect(c.coveragePct).toBeNull();
  });
});
