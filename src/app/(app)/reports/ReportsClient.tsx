"use client";

import { useMemo, useState } from "react";
import type {
  Category,
  Expense,
  ExpenseSplit,
  Profile,
  SettlementBatch,
  SettlementBatchResult,
  SettlementPayment
} from "@/lib/types";
import type { UserBalance } from "@/lib/balances";
import { formatMoney } from "@/lib/format";
import { StatCard } from "@/components/ui/StatCard";
import { FileText, FileSpreadsheet, FileDown, TrendingUp, Wallet, ArrowLeftRight } from "@/components/ui/icons";

interface Props {
  profiles: Profile[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  batches: SettlementBatch[];
  batchResults: SettlementBatchResult[];
  payments: SettlementPayment[];
  categories: Category[];
  balances: UserBalance[];
}

export function ReportsClient({ profiles, expenses, splits, batches, batchResults, payments, categories, balances }: Props) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includeSettlements, setIncludeSettlements] = useState(true);

  const filtered = useMemo(() => expenses.filter((e) => {
    if (from && e.expense_date < from) return false;
    if (to && e.expense_date > to) return false;
    return true;
  }), [expenses, from, to]);

  const splitsByExpense = useMemo(() => {
    const m = new Map<string, ExpenseSplit[]>();
    for (const s of splits) {
      if (!m.has(s.expense_id)) m.set(s.expense_id, []);
      m.get(s.expense_id)!.push(s);
    }
    return m;
  }, [splits]);

  const profilesById = new Map(profiles.map((p) => [p.id, p]));
  const catsById = new Map(categories.map((c) => [c.id, c]));

  function buildRows() {
    return filtered.map((e) => {
      const row: Record<string, string | number> = {
        Date: e.expense_date,
        Merchant: e.merchant,
        Category: e.category_id ? catsById.get(e.category_id)?.name ?? "" : "",
        "Paid by": profilesById.get(e.paid_by_user_id)?.display_name ?? "",
        Total: Number(e.total_amount),
        Currency: e.currency
      };
      const sp = splitsByExpense.get(e.id) ?? [];
      for (const p of profiles) {
        const s = sp.find((x) => x.user_id === p.id);
        row[`${p.display_name} share`] = s ? Number(s.calculated_amount) : 0;
      }
      row["Notes"] = e.notes ?? "";
      return row;
    });
  }

  const batchById = new Map(batches.map((b) => [b.id, b]));

  function buildSettlementRows() {
    return batchResults.map((r) => {
      const b = batchById.get(r.settlement_batch_id);
      return {
        Created: b?.created_at.slice(0, 10) ?? "",
        Ref: b?.settlement_number ?? "",
        From: profilesById.get(r.from_user_id)?.display_name ?? "",
        To: profilesById.get(r.to_user_id)?.display_name ?? "",
        Amount: Number(r.amount),
        Paid: Number(r.amount_paid),
        Remaining: Number(r.remaining_amount),
        "Result status": r.status,
        "Batch status": b?.status ?? "",
        Currency: r.currency,
        "Batch notes": b?.notes ?? ""
      } as Record<string, string | number>;
    });
  }

  function downloadCSV() {
    const rows = buildRows();
    const headers = rows[0] ? Object.keys(rows[0]) : [];
    const lines = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => csvField(r[h])).join(","))
    ];
    if (includeSettlements && batchResults.length) {
      const sRows = buildSettlementRows();
      const sHeaders = Object.keys(sRows[0] ?? {});
      lines.push("");
      lines.push("Settlement payments");
      lines.push(sHeaders.join(","));
      for (const r of sRows) lines.push(sHeaders.map((h) => csvField(r[h])).join(","));
    }
    download(new Blob([lines.join("\n")], { type: "text/csv" }), "expenses.csv");
  }

  async function downloadExcel() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(buildRows());
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    if (includeSettlements && batchResults.length) {
      const ws2 = XLSX.utils.json_to_sheet(buildSettlementRows());
      XLSX.utils.book_append_sheet(wb, ws2, "Settlement payments");
    }
    XLSX.writeFile(wb, "expenses.xlsx");
  }

  async function downloadPDF() {
    const jsPDFMod: any = await import("jspdf");
    const autoTableMod: any = await import("jspdf-autotable");
    const jsPDF = jsPDFMod.default ?? jsPDFMod.jsPDF;
    const autoTable = autoTableMod.default ?? autoTableMod;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("TrackYourGastos — Expense report", 14, 16);
    const rows = buildRows();
    const head = rows[0] ? [Object.keys(rows[0])] : [[]];
    const body = rows.map((r) => head[0].map((h) => formatCell(r[h])));
    autoTable(doc, { head, body, startY: 22, styles: { fontSize: 8 } });
    if (includeSettlements && batchResults.length) {
      doc.addPage();
      doc.text("Settlement payments", 14, 16);
      const sRows = buildSettlementRows();
      const sHead = [Object.keys(sRows[0] ?? {})];
      const sBody = sRows.map((r) => sHead[0].map((h) => formatCell(r[h])));
      autoTable(doc, { head: sHead, body: sBody, startY: 22, styles: { fontSize: 8 } });
    }
    doc.save("expenses.pdf");
  }

  const totalFiltered = filtered.reduce((a, b) => a + Number(b.total_amount), 0);
  const totalSettlements = batchResults.reduce((a, r) => a + Number(r.amount), 0);
  const totalSettlementsPaid = payments.reduce((a, p) => a + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Filtered expenses"
          value={formatMoney(totalFiltered)}
          hint={`${filtered.length} row${filtered.length === 1 ? "" : "s"}`}
          icon={TrendingUp}
          iconBg="green"
        />
        <StatCard
          label="People"
          value={String(profiles.length)}
          hint="Household members"
          icon={Wallet}
          iconBg="blue"
        />
        <StatCard
          label="Settlements"
          value={formatMoney(totalSettlements)}
          hint={`${batches.length} batch${batches.length === 1 ? "" : "es"} · ${formatMoney(totalSettlementsPaid)} paid`}
          icon={ArrowLeftRight}
          iconBg="purple"
        />
      </div>

      <div className="card grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={includeSettlements} onChange={(e) => setIncludeSettlements(e.target.checked)} className="h-4 w-4 rounded text-brand-green focus:ring-brand-green" />
          Include settlements
        </label>
        <p className="text-sm text-slate-500">{filtered.length} rows</p>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-brand-navy">Balances summary</h2>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="table-cell text-left text-xs uppercase tracking-wide text-slate-600">Member</th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Paid</th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Share</th>
              <th className="table-cell text-right text-xs uppercase tracking-wide text-slate-600">Net</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.user_id} className="hover:bg-slate-50">
                <td className="table-cell font-medium">{profilesById.get(b.user_id)?.display_name}</td>
                <td className="table-cell text-right tabular-nums">{formatMoney(b.paid)}</td>
                <td className="table-cell text-right tabular-nums">{formatMoney(b.owed)}</td>
                <td className={`table-cell text-right tabular-nums font-semibold ${b.net > 0 ? "text-brand-green" : b.net < 0 ? "text-brand-danger" : ""}`}>
                  {formatMoney(b.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-brand-navy mb-3">Export</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary text-sm" onClick={downloadCSV}>
            <FileText className="h-4 w-4 text-brand-blue" />
            CSV
          </button>
          <button className="btn-secondary text-sm" onClick={downloadExcel}>
            <FileSpreadsheet className="h-4 w-4 text-brand-green" />
            Excel
          </button>
          <button className="btn-secondary text-sm" onClick={downloadPDF}>
            <FileDown className="h-4 w-4 text-brand-danger" />
            PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function csvField(v: any): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function formatCell(v: any): string {
  if (typeof v === "number") return v.toFixed(2);
  return v == null ? "" : String(v);
}
function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
