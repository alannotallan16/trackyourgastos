"use client";
import { Button } from "@/components/ui/primitives";
import { Download } from "@/components/ui/icons";

export type ReportRow = {
  Direction: string;
  Name: string;
  Counterparty: string;
  Currency: string;
  Scheduled: number;
  Paid: number;
  Remaining: number;
  Overdue: number;
  Status: string;
};

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportBar({ rows }: { rows: ReportRow[] }) {
  const headers = Object.keys(rows[0] ?? { Name: "" }) as (keyof ReportRow)[];

  const toCsv = () => {
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(headers.map((h) => `"${String(r[h]).replace(/"/g, '""')}"`).join(","));
    }
    download("ledgerlink-report.csv", new Blob([lines.join("\n")], { type: "text/csv" }));
  };

  const toXlsx = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Obligations");
    XLSX.writeFile(wb, "ledgerlink-report.xlsx");
  };

  const toPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("LedgerLink — Obligations report", 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [headers as string[]],
      body: rows.map((r) => headers.map((h) => String(r[h]))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] },
    });
    doc.save("ledgerlink-report.pdf");
  };

  if (rows.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" onClick={toCsv}><Download className="h-4 w-4" /> CSV</Button>
      <Button variant="secondary" size="sm" onClick={toXlsx}><Download className="h-4 w-4" /> Excel</Button>
      <Button variant="secondary" size="sm" onClick={toPdf}><Download className="h-4 w-4" /> PDF</Button>
    </div>
  );
}
