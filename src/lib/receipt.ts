import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { inr, formatDate } from "./format";

export interface ReceiptInput {
  receiptNo: string;
  unitNo: string;
  ownerName: string | null;
  type: string;
  month: string;
  year: number | string;
  amountMaintenance: number;
  amountGarbage: number;
  totalPaid: number;
  balance: number;
  paymentDate: string;
  paymentMode: string | null;
  referenceNo: string | null;
  status: string;
}

export function generateReceiptPDF(r: ReceiptInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Residentia", 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("RWA Malabar Red Orchids", 40, 58);
  doc.text("Maintenance Payment Receipt", 40, 74);

  doc.setFontSize(10);
  doc.text(`Receipt #: ${r.receiptNo}`, W - 40, 40, { align: "right" });
  doc.text(`Date: ${formatDate(r.paymentDate)}`, W - 40, 56, { align: "right" });
  doc.text(`Status: ${r.status}`, W - 40, 72, { align: "right" });

  // Resident info
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Resident", 40, 130);
  doc.setFont("helvetica", "normal");
  doc.text(`Unit ${r.unitNo}  ·  ${r.type}`, 40, 148);
  doc.text(r.ownerName ?? "—", 40, 164);

  doc.setFont("helvetica", "bold");
  doc.text("Billing Cycle", W - 40, 130, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`${r.month} ${r.year}`, W - 40, 148, { align: "right" });
  doc.text(`Mode: ${r.paymentMode ?? "—"}`, W - 40, 164, { align: "right" });
  if (r.referenceNo) doc.text(`Ref: ${r.referenceNo}`, W - 40, 180, { align: "right" });

  // Charges table
  autoTable(doc, {
    startY: 210,
    head: [["Description", "Amount"]],
    body: [
      ["Maintenance charges", inr(r.amountMaintenance)],
      ["Garbage collection", inr(r.amountGarbage)],
      [{ content: "Total Paid", styles: { fontStyle: "bold" } }, { content: inr(r.totalPaid), styles: { fontStyle: "bold" } }],
      ["Balance Due", inr(r.balance)],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
    styles: { fontSize: 11, cellPadding: 8 },
    columnStyles: { 1: { halign: "right" } },
  });

  // Footer
  const y = (doc as any).lastAutoTable.finalY + 40;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text("This is a system-generated receipt and does not require a signature.", 40, y);
  doc.text("Residentia — RWA Malabar Red Orchids · Resident Payment Portal", 40, y + 14);

  doc.save(`Receipt-${r.unitNo}-${r.month}-${r.year}.pdf`);
}
