import { pool } from "./client.server";

const ALLOWED_TABLES = new Set([
  "units",
  "billing_cycles",
  "payments",
  "queries",
  "waivers",
  "announcements",
  "profiles",
  "user_roles",
  "notifications",
  "pricing",
  "users",
  "tenants",
]);

const FK_RELATIONS: Record<
  string,
  Record<string, { localCol: string; remoteTable: string; remoteCol: string }>
> = {
  billing_cycles: {
    units: { localCol: "unit_id", remoteTable: "units", remoteCol: "id" },
  },
  payments: {
    units: { localCol: "unit_id", remoteTable: "units", remoteCol: "id" },
    billing_cycles: {
      localCol: "billing_cycle_id",
      remoteTable: "billing_cycles",
      remoteCol: "id",
    },
  },
  queries: {
    units: { localCol: "unit_id", remoteTable: "units", remoteCol: "id" },
  },
  waivers: {
    units: { localCol: "unit_id", remoteTable: "units", remoteCol: "id" },
  },
  profiles: {
    units: { localCol: "unit_id", remoteTable: "units", remoteCol: "id" },
  },
};

interface Filter {
  type: string;
  column: string;
  value: unknown;
  op?: string;
}

interface Order {
  column: string;
  ascending?: boolean;
}

interface RelSelect {
  table: string;
  columns: string[];
}

interface DbRequest {
  op: string;
  table: string;
  select?: string;
  filters?: Filter[];
  order?: Order[];
  limit?: number;
  data?: any;
  single?: boolean;
  maybeSingle?: boolean;
  onConflict?: string;
}

function parseSelect(select: string): { columns: string[]; relations: RelSelect[] } {
  const columns: string[] = [];
  const relations: RelSelect[] = [];
  const parts = select.split(",").map((s) => s.trim());
  for (const part of parts) {
    const relMatch = part.match(/^(\w+)\s*\(([^)]+)\)$/);
    if (relMatch) {
      relations.push({
        table: relMatch[1],
        columns: relMatch[2].split(",").map((c) => c.trim()),
      });
    } else {
      columns.push(part);
    }
  }
  return { columns, relations };
}

function buildFilters(filters: Filter[] | undefined, params: any[]): string {
  if (!filters || filters.length === 0) return "";

  const conditions: string[] = [];
  for (const f of filters) {
    switch (f.type) {
      case "eq":
        params.push(f.value);
        conditions.push(`t."${f.column}" = $${params.length}`);
        break;
      case "in": {
        const arr = f.value as any[];
        if (arr.length === 0) {
          conditions.push("FALSE");
        } else {
          const phs = arr.map((v) => {
            params.push(v);
            return `$${params.length}`;
          });
          conditions.push(`t."${f.column}" IN (${phs.join(", ")})`);
        }
        break;
      }
      case "not": {
        const op = f.op || "is";
        if (op === "is" && f.value === null) {
          conditions.push(`NOT (t."${f.column}" IS NULL)`);
        } else if (op === "eq") {
          params.push(f.value);
          conditions.push(`NOT (t."${f.column}" = $${params.length})`);
        } else {
          params.push(f.value);
          conditions.push(`NOT (t."${f.column}" ${op} $${params.length})`);
        }
        break;
      }
      default:
        params.push(f.value);
        conditions.push(`t."${f.column}" = $${params.length}`);
    }
  }

  return conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";
}

function reshapeRow(row: any, relations: RelSelect[]): any {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith("__rel_")) {
      result[key] = value;
    }
  }
  for (const rel of relations) {
    const prefix = `__rel_${rel.table}__`;
    const nested: Record<string, any> = {};
    let hasNonNull = false;
    for (const col of rel.columns) {
      const key = `${prefix}${col}`;
      const value = row[key];
      nested[col] = value ?? null;
      if (value !== null) hasNonNull = true;
    }
    result[rel.table] = hasNonNull ? nested : null;
  }
  return result;
}

async function handleSelect(body: DbRequest) {
  const {
    table,
    select: selectStr = "*",
    filters,
    order,
    limit,
    single,
    maybeSingle,
  } = body;

  if (!ALLOWED_TABLES.has(table)) {
    return { error: `Invalid table: ${table}` };
  }

  const params: any[] = [];
  const { columns, relations } = parseSelect(selectStr);

  const selectParts: string[] = [];
  if (columns.includes("*")) {
    selectParts.push("t.*");
  } else {
    for (const c of columns) {
      selectParts.push(`t."${c}"`);
    }
  }

  const joins: string[] = [];
  for (const rel of relations) {
    const relFk = FK_RELATIONS[table]?.[rel.table];
    if (!relFk) {
      return { error: `Unknown relationship: ${rel.table} on ${table}` };
    }
    const alias = `__j_${rel.table}`;
    joins.push(
      `LEFT JOIN ${relFk.remoteTable} AS ${alias} ON t."${relFk.localCol}" = ${alias}."${relFk.remoteCol}"`,
    );
    for (const col of rel.columns) {
      selectParts.push(`${alias}."${col}" AS "__rel_${rel.table}__${col}"`);
    }
  }

  const where = buildFilters(filters, params);

  let orderBy = "";
  if (order && order.length > 0) {
    const parts = order.map(
      (o) => `t."${o.column}" ${o.ascending === false ? "DESC" : "ASC"}`,
    );
    orderBy = " ORDER BY " + parts.join(", ");
  }

  let limitStr = "";
  if (limit) {
    params.push(limit);
    limitStr = ` LIMIT $${params.length}`;
  }

  const sql = `SELECT ${selectParts.join(", ")} FROM ${table} AS t${joins.join(" ")}${where}${orderBy}${limitStr}`;
  const result = await pool.query(sql, params);
  const rows = result.rows.map((row) => reshapeRow(row, relations));

  if (single) {
    if (rows.length === 0) return { error: "Row not found" };
    return { data: rows[0] };
  }
  if (maybeSingle) {
    return { data: rows[0] ?? null };
  }
  return { data: rows };
}

async function handleInsert(body: DbRequest) {
  const { table, data, select: selectStr, single, maybeSingle } = body;

  if (!ALLOWED_TABLES.has(table)) {
    return { error: `Invalid table: ${table}` };
  }

  if (!data || (typeof data !== "object")) {
    return { error: "Invalid data" };
  }

  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`);

  let sql = `INSERT INTO ${table} (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${placeholders.join(", ")})`;

  if (selectStr) {
    sql += ` RETURNING ${selectStr === "*" ? "*" : selectStr.split(",").map((c) => `"${c.trim()}"`).join(", ")}`;
  }

  const result = await pool.query(sql, values);

  if (selectStr) {
    const rows = result.rows;
    if (single) {
      if (rows.length === 0) return { error: "Row not found" };
      return { data: rows[0] };
    }
    if (maybeSingle) {
      return { data: rows[0] ?? null };
    }
    return { data: rows };
  }

  return { data: null };
}

async function handleUpdate(body: DbRequest) {
  const { table, data, filters } = body;

  if (!ALLOWED_TABLES.has(table)) {
    return { error: `Invalid table: ${table}` };
  }

  const params: any[] = [];
  const setParts: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    params.push(value);
    setParts.push(`"${key}" = $${params.length}`);
  }

  const where = buildFilters(filters, params);
  const sql = `UPDATE ${table} SET ${setParts.join(", ")}${where} RETURNING *`;
  const result = await pool.query(sql, params);
  return { data: result.rows };
}

async function handleDelete(body: DbRequest) {
  const { table, filters } = body;

  if (!ALLOWED_TABLES.has(table)) {
    return { error: `Invalid table: ${table}` };
  }

  const params: any[] = [];
  const where = buildFilters(filters, params);
  const sql = `DELETE FROM ${table}${where} RETURNING *`;
  const result = await pool.query(sql, params);
  return { data: result.rows };
}

async function handleUpsert(body: DbRequest) {
  const { table, data, onConflict } = body;

  if (!ALLOWED_TABLES.has(table)) {
    return { error: `Invalid table: ${table}` };
  }

  if (!onConflict) {
    return { error: "onConflict is required for upsert" };
  }

  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) return { data: [] };

  const keys = Object.keys(rows[0]);
  const allValues: any[] = [];
  const rowPlaceholders: string[] = [];

  for (const row of rows) {
    const phs = keys.map((k) => {
      allValues.push(row[k]);
      return `$${allValues.length}`;
    });
    rowPlaceholders.push(`(${phs.join(", ")})`);
  }

  const updateCols = keys.filter((k) => k !== onConflict);
  const updateParts = updateCols.map((k) => `"${k}" = EXCLUDED."${k}"`);

  const sql = `INSERT INTO ${table} (${keys.map((k) => `"${k}"`).join(", ")}) VALUES ${rowPlaceholders.join(", ")} ON CONFLICT ("${onConflict}") DO UPDATE SET ${updateParts.join(", ")} RETURNING *`;

  const result = await pool.query(sql, allValues);
  return { data: result.rows };
}

export async function handleDbRequest(
  body: DbRequest,
): Promise<{ data?: any; error?: string }> {
  try {
    switch (body.op) {
      case "select":
        return await handleSelect(body);
      case "insert":
        return await handleInsert(body);
      case "update":
        return await handleUpdate(body);
      case "delete":
        return await handleDelete(body);
      case "upsert":
        return await handleUpsert(body);
      default:
        return { error: `Unknown operation: ${body.op}` };
    }
  } catch (err: any) {
    console.error("[db.server]", err.message);
    return { error: err.message || "Database error" };
  }
}
