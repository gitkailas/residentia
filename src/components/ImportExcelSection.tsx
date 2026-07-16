import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  parseExcelFile,
  generateTemplate,
  APARTMENT_MAPPINGS,
  type ParsedRow,
} from "@/lib/import-excel";
import {
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Trash2,
} from "lucide-react";

interface ImportExcelSectionProps {
  /** Called with the validated rows ready for DB upsert */
  onImport: (rows: Record<string, unknown>[]) => Promise<void>;
  /** Whether import is in progress (external) */
  busy?: boolean;
}

type PreviewRow = Record<string, unknown> & { __rowNumber: number; __hasError: boolean };

const PREVIEW_COLUMNS = [
  "unit_no",
  "floor",
  "type",
  "property_name",
  "owner_name",
  "owner_phone",
  "area_sqft",
  "status",
  "occupancy_type",
  "monthly_rent",
] as const;

const COLUMN_LABELS: Record<string, string> = {
  unit_no: "Unit",
  floor: "Floor",
  type: "Type",
  property_name: "Property",
  owner_name: "Owner",
  owner_phone: "Phone",
  area_sqft: "Area",
  status: "Status",
  occupancy_type: "Occupancy",
  monthly_rent: "Rent",
};

export function ImportExcelSection({ onImport, busy }: ImportExcelSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<{ rowNumber: number; message: string }[]>([]);
  const [imported, setImported] = useState(false);
  const [importCount, setImportCount] = useState(0);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setImported(false);
    setImportCount(0);

    const result = await parseExcelFile(file, APARTMENT_MAPPINGS);
    setParseErrors(result.errors);
    setParsed(result.rows);
  }, []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
      e.target.value = "";
    },
    [handleFile],
  );

  const clearFile = useCallback(() => {
    setFileName("");
    setParsed([]);
    setParseErrors([]);
    setImported(false);
    setImportCount(0);
  }, []);

  async function doImport() {
    if (!parsed.length) return;
    const rows = parsed.map((r) => r.data);
    await onImport(rows);
    setImported(true);
    setImportCount(rows.length);
  }

  const validRows = parsed.filter((r) => {
    // A row is "valid" if it doesn't have a missing required field
    return r.data.unit_no && r.data.floor;
  });

  // ── No file selected yet ─────────────────────────────────
  if (!fileName) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Upload an Excel or CSV file</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Accepts .xlsx, .xls, or .csv files with apartment data
          </p>
        </div>
        <div className="flex gap-2">
          <Label className="cursor-pointer">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={onFileChange}
            />
            <span className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted">
              <Upload className="h-4 w-4" />
              Choose file
            </span>
          </Label>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => generateTemplate(APARTMENT_MAPPINGS)}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download template
          </Button>
        </div>
        <div className="w-full max-w-md rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium">Expected columns (header row):</p>
          <p className="mt-1 break-words font-mono">
            unit_no, floor, type, property_name, owner_name, owner_phone, area_sqft,
            status, occupancy_type, monthly_rent, description, registration_date,
            key_handover_date
          </p>
          <p className="mt-2">
            Only <strong>unit_no</strong>, <strong>floor</strong>, and{" "}
            <strong>type</strong> are required. Existing units (matched by unit_no)
            will be updated.
          </p>
        </div>
      </div>
    );
  }

  // ── Import succeeded ─────────────────────────────────────
  if (imported) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">
            Successfully imported {importCount} apartment{importCount !== 1 ? "s" : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            You can close this dialog or import another file.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" type="button" onClick={clearFile}>
            Import another file
          </Button>
        </div>
      </div>
    );
  }

  // ── File selected, show preview ──────────────────────────
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{fileName}</p>
          <p className="text-xs text-muted-foreground">
            {parsed.length} row{parsed.length !== 1 ? "s" : ""} found
            {parseErrors.length > 0 && (
              <span className="ml-1 text-amber-600">
                · {parseErrors.length} validation error{parseErrors.length !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <Button variant="ghost" size="sm" type="button" onClick={clearFile}>
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Remove
        </Button>
      </div>

      {parseErrors.length > 0 && (
        <div className="max-h-24 overflow-auto rounded-md border border-amber-200 bg-amber-50 p-2 text-xs">
          {parseErrors.slice(0, 10).map((e, i) => (
            <div key={i} className="flex items-start gap-1.5 text-amber-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                Row {e.rowNumber}: {e.message}
              </span>
            </div>
          ))}
          {parseErrors.length > 10 && (
            <p className="mt-1 text-amber-600">…and {parseErrors.length - 10} more errors</p>
          )}
        </div>
      )}

      <div className="max-h-64 overflow-auto rounded border text-xs">
        <table className="w-full">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr>
              <th className="p-2 text-left text-muted-foreground">#</th>
              {PREVIEW_COLUMNS.map((col) => (
                <th key={col} className="p-2 text-left text-muted-foreground">
                  {COLUMN_LABELS[col] || col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.slice(0, 100).map((r, i) => {
              const hasError = !r.data.unit_no || !r.data.floor;
              return (
                <tr
                  key={i}
                  className={`border-t ${hasError ? "bg-amber-50" : ""}`}
                >
                  <td className="p-2 text-muted-foreground">{r.rowNumber}</td>
                  {PREVIEW_COLUMNS.map((col) => (
                    <td key={col} className="p-2 font-mono">
                      {r.data[col] != null ? String(r.data[col]) : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {parsed.length > 100 && (
        <p className="text-xs text-muted-foreground">
          Showing first 100 of {parsed.length} rows
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => generateTemplate(APARTMENT_MAPPINGS)}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Template
        </Button>
        <Button
          onClick={doImport}
          disabled={busy || parsed.length === 0}
          className="bg-primary hover:bg-primary/90"
        >
          {busy
            ? "Importing…"
            : `Import ${parsed.length} apartment${parsed.length !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}
