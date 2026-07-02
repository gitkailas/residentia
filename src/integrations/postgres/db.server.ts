import { pgPool } from "./client.server";
import { verifyJwt } from "./client.server";

const relationMap: Record<string, Record<string, { local: string; foreign: string }>> = {
  payments: {
    units: { local: "unit_id", foreign: "id" },
    billing_cycles: { local: "billing_cycle_id", foreign: "id" },
  },
  queries: {
    units: { local: "unit_id", foreign: "id" },
  },
  waivers: {
    units: { local: "unit_id", foreign: "id" },
    billing_cycles: { local: "billing_cycle_id", foreign: "id" },
  },
};

function splitTopLevelCommas(input: string) {
  const items: string[] = [];
  let buffer = "";
  let depth = 0;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === "(") {
      depth += 1;
      buffer += char;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      buffer += char;
      continue;
    }
    if (char === "," && depth === 0) {
      items.push(buffer.trim());
      buffer = "";
      continue;
    }
    buffer += char;
  }
  if (buffer.trim().length > 0) {
    items.push(buffer.trim());
  }
  return items.filter(Boolean);
}

function buildSelectClause(table: string, selectInput: string) {
  const baseAlias = "t";
  const selected: string[] = [];
  const joins: Array<{ table: string; alias: string; condition: string }> = [];
  const nestedKeys: string[] = [];

  const tokens = splitTopLevelCommas(selectInput);
  for (const token of tokens) {
    if (token === "*") {
      selected.push(`${baseAlias}.*`);
      continue;
    }

    const nestedMatch = token.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/);
    if (nestedMatch) {
      const relation = nestedMatch[1];
      const fields = splitTopLevelCommas(nestedMatch[2]);
      const relationInfo = relationMap[table]?.[relation];
      if (!relationInfo) {
        throw new Error(`Unsupported relation '${relation}' for table '${table}'.`);
      }
      const alias = relation;
      if (!joins.some((join) => join.alias === alias)) {
        joins.push({
          table: relation,
          alias,
          condition: `${alias}.${relationInfo.foreign} = ${baseAlias}.${relationInfo.local}`,
        });
      }
      for (const field of fields) {
        selected.push(`${alias}.${field.trim()} AS ${alias}__${field.trim()}`);
        nestedKeys.push(`${alias}__${field.trim()}`);
      }
      continue;
    }

    selected.push(`${baseAlias}.${token}`);
  }

  return { selected, joins, nestedKeys };
}

function buildWhere(filters: any[], startIndex = 1) {
  const clauses: string[] = [];
  const values: any[] = [];
  let index = startIndex;

  for (const filter of filters) {
    const { type, column, operator, value } = filter;
    const columnRef = `t.${column}`;
    if (type === "eq") {
      if (value === null) {
        clauses.push(`${columnRef} IS NULL`);
      } else {
        clauses.push(`${columnRef} = $${index}`);
        values.push(value);
        index += 1;
      }
      continue;
    }

    if (type === "in") {
      if (!Array.isArray(value) || value.length === 0) {
        clauses.push("FALSE");
      } else {
        const placeholders = value.map((_, i) => `$${index + i}`).join(", ");
        clauses.push(`${columnRef} IN (${placeholders})`);
        values.push(...value);
        index += value.length;
      }
      continue;
    }

    if (type === "not") {
      if (operator === "is" && value === null) {
        clauses.push(`NOT (${columnRef} IS NULL)`);
        continue;
      }
      if (operator === "=" || operator === "eq") {
        clauses.push(`NOT (${columnRef} = $${index})`);
        values.push(value);
        index += 1;
        continue;
      }
      throw new Error(`Unsupported NOT operator '${operator}'.`);
    }

    throw new Error(`Unsupported filter type '${type}'.`);
  }

  return { clause: clauses.length > 0 ? clauses.join(" AND ") : null, values };
}

function buildOrder(order: Array<{ column: string; ascending?: boolean }>) {
  if (!order.length) return null;
  return order
    .map((item) => `t.${item.column} ${item.ascending === false ? "DESC" : "ASC"}`)
    .join(", ");
}

function normalizeRows(rows: any[]) {
  return rows.map((row) => {
    const normalized = { ...row };
    for (const key of Object.keys(row)) {
      if (!key.includes("__")) continue;
      const [relation, field] = key.split("__");
      normalized[relation] = normalized[relation] || {};
      normalized[relation][field] = row[key];
      delete normalized[key];
    }
    return normalized;
  });
}

export async function verifyRequestToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.replace("Bearer ", "");
  try {
    return verifyJwt(token);
  } catch {
    return null;
  }
}

export async function handleDbRequest(request: Request) {
  const body = await request.json();
  const {
    op,
    table,
    select,
    filters = [],
    order = [],
    limit,
    data,
    conflict,
    single,
    maybeSingle,
  } = body as {
    op: string;
    table: string;
    select?: string;
    filters?: any[];
    order?: Array<{ column: string; ascending?: boolean }>;
    limit?: number;
    data?: any;
    conflict?: string;
    single?: boolean;
    maybeSingle?: boolean;
  };

  if (!op || !table) {
    return new Response(JSON.stringify({ error: { message: "Missing op or table" } }), { status: 400 });
  }

  const tokenClaims = await verifyRequestToken(request);
  if (!tokenClaims) {
    return new Response(JSON.stringify({ error: { message: "Unauthorized" } }), { status: 401 });
  }

  let sql = "";
  const values: any[] = [];

  if (op === "select") {
    const { selected, joins } = buildSelectClause(table, select || "*");
    const { clause, values: whereValues } = buildWhere(filters);
    if (whereValues.length) values.push(...whereValues);
    const orderClause = buildOrder(order);

    sql = `SELECT ${selected.join(", ")} FROM public.${table} t`;
    for (const join of joins) {
      sql += ` LEFT JOIN public.${join.table} ${join.alias} ON ${join.condition}`;
    }
    if (clause) sql += ` WHERE ${clause}`;
    if (orderClause) sql += ` ORDER BY ${orderClause}`;
    if (typeof limit === "number") sql += ` LIMIT ${limit}`;
  } else if (op === "insert") {
    const rows = Array.isArray(data) ? data : [data];
    if (!rows.length) {
      return new Response(JSON.stringify({ data: [] }));
    }
    const columns = Object.keys(rows[0]);
    const placeholders = rows
      .map((row, rowIndex) => `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(", ")})`)
      .join(", ");
    values.push(...rows.flatMap((row) => columns.map((column) => (row as any)[column])));
    sql = `INSERT INTO public.${table} (${columns.join(", ")}) VALUES ${placeholders} RETURNING *`;
  } else if (op === "update") {
    if (!data || typeof data !== "object") {
      return new Response(JSON.stringify({ error: { message: "Missing update data" } }), { status: 400 });
    }
    const columns = Object.keys(data);
    if (!columns.length) {
      return new Response(JSON.stringify({ error: { message: "Nothing to update" } }), { status: 400 });
    }
    const setClause = columns.map((column, index) => `${column} = $${index + 1}`).join(", ");
    values.push(...columns.map((column) => (data as any)[column]));
    const { clause, values: whereValues } = buildWhere(filters, columns.length + 1);
    if (!clause) {
      return new Response(JSON.stringify({ error: { message: "Update requires a filter" } }), { status: 400 });
    }
    values.push(...whereValues);
    sql = `UPDATE public.${table} t SET ${setClause} WHERE ${clause} RETURNING *`;
  } else if (op === "delete") {
    const { clause, values: whereValues } = buildWhere(filters);
    if (!clause) {
      return new Response(JSON.stringify({ error: { message: "Delete requires a filter" } }), { status: 400 });
    }
    values.push(...whereValues);
    sql = `DELETE FROM public.${table} t WHERE ${clause} RETURNING *`;
  } else if (op === "upsert") {
    const rows = Array.isArray(data) ? data : [data];
    if (!rows.length) {
      return new Response(JSON.stringify({ data: [] }));
    }
    if (!conflict) {
      return new Response(JSON.stringify({ error: { message: "Upsert requires onConflict key" } }), { status: 400 });
    }
    const columns = Object.keys(rows[0]);
    const insertPlaceholders = rows
      .map((row, rowIndex) => `(${columns.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`).join(", ")})`)
      .join(", ");
    values.push(...rows.flatMap((row) => columns.map((column) => (row as any)[column])));
    const updateColumns = columns.filter((column) => column !== conflict);
    const updateClause = updateColumns.map((column) => `${column} = EXCLUDED.${column}`).join(", ");
    sql = `INSERT INTO public.${table} (${columns.join(", ")}) VALUES ${insertPlaceholders} ON CONFLICT (${conflict}) DO UPDATE SET ${updateClause} RETURNING *`;
  } else {
    return new Response(JSON.stringify({ error: { message: `Unsupported operation '${op}'` } }), { status: 400 });
  }

  try {
    console.log(`[DB] Executing: ${op.toUpperCase()} on table: ${table}`);
    console.log(`[DB] SQL: ${sql}`);
    const result = await pgPool.query(sql, values);
    let rows = result.rows;
    if (op === "select") {
      rows = normalizeRows(rows);
      if (single) {
        if (rows.length !== 1) {
          return new Response(JSON.stringify({ error: { message: "Expected a single row" } }), { status: 400 });
        }
        return new Response(JSON.stringify({ data: rows[0] }), { status: 200 });
      }
      if (maybeSingle) {
        return new Response(JSON.stringify({ data: rows.length > 0 ? rows[0] : null }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: rows }), { status: 200 });
    }
    if (single) {
      if (rows.length !== 1) {
        return new Response(JSON.stringify({ error: { message: "Expected a single row" } }), { status: 400 });
      }
      return new Response(JSON.stringify({ data: rows[0] }), { status: 200 });
    }
    if (maybeSingle) {
      return new Response(JSON.stringify({ data: rows.length > 0 ? rows[0] : null }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: rows }), { status: 200 });
  } catch (error: unknown) {
    console.error(`[DB] Error on ${op.toUpperCase()} table ${table}:`, error);
    return new Response(JSON.stringify({ error: { message: (error as Error).message || "Database error" } }), { status: 500 });
  }
}
