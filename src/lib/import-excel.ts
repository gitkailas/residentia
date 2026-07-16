import * as XLSX from "xlsx";

export interface ColumnMapping {
  /** DB column name */
  dbField: string;
  /** Accepted spreadsheet header names (case-insensitive, checked in order) */
  aliases: string[];
  /** Whether this field is required */
  required?: boolean;
  /** Default value if cell is empty */
  defaultValue?: unknown;
  /** Transform raw cell value before storing */
  transform?: (value: unknown, row: Record<string, unknown>) => unknown;
}

export interface ParsedRow {
  data: Record<string, unknown>;
  rowNumber: number;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: { rowNumber: number; message: string }[];
  headers: string[];
}

/**
 * Parse an Excel / CSV file and map columns using the provided mappings.
 */
export async function parseExcelFile(
  file: File,
  mappings: ColumnMapping[],
): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { rows: [], errors: [], headers: [] };

  const sheet = workbook.Sheets[sheetName];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: false,
  });

  if (raw.length === 0) return { rows: [], errors: [], headers: [] };

  const headers = Object.keys(raw[0]);

  // Build a lookup: lowercased header → original header
  const headerMap = new Map<string, string>();
  for (const h of headers) {
    headerMap.set(h.toLowerCase().trim(), h);
  }

  // For each mapping, find which spreadsheet column it matches
  const resolvedMappings = mappings.map((m) => {
    for (const alias of m.aliases) {
      const orig = headerMap.get(alias.toLowerCase().trim());
      if (orig) return { ...m, spreadsheetCol: orig };
    }
    return { ...m, spreadsheetCol: null as string | null };
  });

  const rows: ParsedRow[] = [];
  const errors: { rowNumber: number; message: string }[] = [];

  for (let i = 0; i < raw.length; i++) {
    const rawRow = raw[i];
    const rowNum = i + 2; // +2 because row 1 is headers, and array is 0-indexed
    const rowData: Record<string, unknown> = {};
    let hasError = false;

    for (const rm of resolvedMappings) {
      let value: unknown = null;

      if (rm.spreadsheetCol) {
        value = rawRow[rm.spreadsheetCol] ?? null;
        if (typeof value === "string") value = value.trim();
        if (value === "") value = null;
      }

      // Apply transform
      if (value !== null && rm.transform) {
        value = rm.transform(value, rawRow);
      }

      // Apply default
      if (value === null || value === undefined) {
        value = rm.defaultValue ?? null;
      }

      // Validate required
      if (rm.required && (value === null || value === undefined || value === "")) {
        errors.push({ rowNumber: rowNum, message: `Missing required field: ${rm.dbField}` });
        hasError = true;
      }

      rowData[rm.dbField] = value;
    }

    // Skip entirely empty rows
    const hasAnyValue = Object.values(rowData).some(
      (v) => v !== null && v !== undefined && v !== "",
    );
    if (!hasAnyValue) continue;

    rows.push({ data: rowData, rowNumber: rowNum });
  }

  return { rows, errors, headers };
}

/**
 * Generate a sample Excel template for download.
 */
export function generateTemplate(mappings: ColumnMapping[]): void {
  const headers = mappings.map((m) => m.dbField);
  const exampleRow: Record<string, unknown> = {};
  for (const m of mappings) {
    if (m.dbField === "unit_no") exampleRow[m.dbField] = "A101";
    else if (m.dbField === "floor") exampleRow[m.dbField] = 1;
    else if (m.dbField === "type") exampleRow[m.dbField] = "2BHK";
    else if (m.dbField === "status") exampleRow[m.dbField] = "vacant";
    else if (m.dbField === "property_name") exampleRow[m.dbField] = "Lakeview Apartments";
    else if (m.dbField === "area_sqft") exampleRow[m.dbField] = 1200;
    else if (m.dbField === "occupancy_type") exampleRow[m.dbField] = "owner_occupied";
    else if (m.dbField === "monthly_rent") exampleRow[m.dbField] = 15000;
    else exampleRow[m.dbField] = "";
  }

  const ws = XLSX.utils.json_to_sheet([exampleRow], { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Import");
  XLSX.writeFile(wb, "apartments-import-template.xlsx");
}

/** Standard column mappings for apartment import */
export const APARTMENT_MAPPINGS: ColumnMapping[] = [
  { dbField: "unit_no", aliases: ["unit_no", "unit", "flat_no", "flatno", "flat number", "unit number"], required: true },
  { dbField: "floor", aliases: ["floor", "floor_no", "floorno", "floor number", "level"], required: true, transform: (v) => Number(v) || 0 },
  { dbField: "type", aliases: ["type", "unit_type", "apartment_type", "bhk", "configuration"], required: true, defaultValue: "2BHK" },
  { dbField: "property_name", aliases: ["property_name", "property", "apartment_name", "building_name", "building", "project"], defaultValue: null },
  { dbField: "owner_name", aliases: ["owner_name", "owner", "tenant", "tenant_name", "name", "resident_name"], defaultValue: null },
  { dbField: "owner_phone", aliases: ["owner_phone", "phone", "phone_no", "phoneno", "mobile", "contact", "tenant_phone"], defaultValue: null },
  { dbField: "area_sqft", aliases: ["area_sqft", "area", "sqft", "sq_ft", "super_area", "carpet_area"], defaultValue: null, transform: (v) => (v ? Number(v) : null) },
  { dbField: "status", aliases: ["status", "unit_status"], defaultValue: "vacant" },
  { dbField: "occupancy_type", aliases: ["occupancy_type", "occupancy"], defaultValue: "owner_occupied" },
  { dbField: "monthly_rent", aliases: ["monthly_rent", "rent", "rent_amount", "rental"], defaultValue: 0, transform: (v) => (v ? Number(v) : 0) },
  { dbField: "description", aliases: ["description", "desc", "notes", "remarks"], defaultValue: null },
  { dbField: "registration_date", aliases: ["registration_date", "reg_date", "registration"], defaultValue: null },
  { dbField: "key_handover_date", aliases: ["key_handover_date", "handover_date", "handover", "key_date"], defaultValue: null },
];
