/**
 * Linked-obligation coverage: does incoming money (an "owed_to_me" obligation)
 * cover an outgoing one ("i_owe") for a period? Mirrors the SQL link_coverage
 * view so the number is testable in isolation. Amounts are integer centavos.
 */
import { Centavos } from "./money";

export type CoverageStatus = "covered" | "partially_covered" | "underfunded";

export type Coverage = {
  incomingExpected: Centavos;
  outgoingDue: Centavos;
  incomingReceived: Centavos;
  coveragePct: number | null; // null when nothing is due
  shortfall: Centavos;
  status: CoverageStatus;
};

export function computeCoverage(args: {
  incomingExpected: Centavos;
  outgoingDue: Centavos;
  incomingReceived?: Centavos;
}): Coverage {
  const incomingExpected = args.incomingExpected;
  const outgoingDue = args.outgoingDue;
  const incomingReceived = args.incomingReceived ?? 0;

  const coveragePct =
    outgoingDue > 0 ? Math.round((incomingExpected / outgoingDue) * 10000) / 100 : null;
  const shortfall = Math.max(outgoingDue - incomingExpected, 0);

  let status: CoverageStatus;
  if (outgoingDue === 0) status = "covered";
  else if (incomingExpected >= outgoingDue) status = "covered";
  else if (incomingExpected > 0) status = "partially_covered";
  else status = "underfunded";

  return { incomingExpected, outgoingDue, incomingReceived, coveragePct, shortfall, status };
}
