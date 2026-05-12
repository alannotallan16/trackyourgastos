"use client";

import { useMemo, useState } from "react";
import type { Category, Expense, ExpenseSplit, Profile, Settlement } from "@/lib/types";
import type { UserBalance } from "@/lib/balances";
import { formatMoney } from "@/lib/format";

interface Props {
  profiles: Profile[];
  expenses: Expense[];
  splits: ExpenseSplit[];
  settlements: Settlement[];
  categories: Category[];
  balances: UserBalance[];
}

export function ReportsClient({ profiles, expenses, splits, settlements, categories, balances }: Props) {
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

  function downloadCSV() {
    const rows = buildRows();
    const headers = rows[0] ? Object.keys(rows[0]) : [];
    const lines = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => csvField(r[h])).join(","))
    ];
    if (includeSettlements && settlements.length) {
      lines.push("");
      lines.push("Settlements");
      lines.push(["Date", "From", "To", "Amount", "Currency", "Notes"].join(","));
      for (const s of settlements) {
        lines.push(
          [
            s.settled_on,
            profilesById.get(s.from_user_id)?.display_name ?? "",
            profilesById.get(s.to_user_id)?.display_name ?? "",
            String(s.amount),
            s.currency,
            csvField(s.notes ?? "")
          ].join(",")
        );
      }
    }
    download(new Blob([lines.join("\n")], { type: "text/csv" }), "expenses.csv");
  }

  async function downloadExcel() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(buildRows());
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    if (includeSettlements && settlements.length) {
      const ws2 = XLSX.utils.json_to_sheet(
        settlements.map((s) => ({
          Date: s.settled_on,
          From: profilesById.get(s.from_user_id)?.display_name ?? "",
          To: profilesById.get(s.to_user_id)?.display_name ?? "",
          Amount: Number(s.amount),
          Currency: s.currency,
          Notes: s.notes ?? ""
        }))
      );
      XLSX.utils.book_append_sheet(wb, ws2, "Settlements");
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
    if (includeSettlements && settlements.length) {
      doc.addPage();
      doc.text("Settlements", 14, 16);
      const sHead = [["Date", "From", "To", "Amount", "Currency", "Notes"]];
      const sBody = settlements.map((s) => [
        s.settled_on,
        profilesById.get(s.from_user_id)?.display_name ?? "",
        profilesById.get(s.to_user_id)?.display_name ?? "",
        Number(s.amount).toFixed(2),
        s.currency,
        s.notes ?? ""
      ]);
      autoTable(doc, { head: sHead, body: sBody, startY: 22, styles: { fontSize: 8 } });
    }
    doc.save("expenses.pdf");
  }

  return (
    <div className="space-y-4">
      <div className="card grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeSettlements} onChange={(e) => setIncludeSettlements(e.target.checked)} />
          Include settlements
        </label>
        <p className="text-sm text-slate-500">{filtered.length} rows</p>
      </div>

      <div className="card">
        <h2 className="font-medium mb-2">Balances summary</h2>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="table-cell text-left">Member</th>
              <th className="table-cell text-right">Paid</th>
              <th className="table-cell text-right">Share</th>
              <th className="table-cell text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.user_id}>
                <td className="table-cell">{profilesById.get(b.user_id)?.display_name}</td>
                <td className="table-cell text-right tabular-nums">{formatMoney(b.paid)}</td>
                <td className="table-cell text-right tabular-nums">{formatMoney(b.owed)}</td>
                <td className={`table-cell text-right tabular-nums ${b.net > 0 ? "text-emerald-600" : b.net < 0 ? "text-red-600" : ""}`}>
                  {formatMoney(b.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card flex flex-wrap gap-2">
        <button className="btn-primary text-sm" onClick={downloadCSV}>Export CSV</button>
        <button className="btn-primary text-sm" onClick={downloadExcel}>Export Excel</button>
        <button className="btn-primary text-sm" onClick={downloadPDF}>Export PDF</button>
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
