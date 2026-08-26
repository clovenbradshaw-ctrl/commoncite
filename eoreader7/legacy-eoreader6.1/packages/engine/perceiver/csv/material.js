// eoreader6 · perceiver/csv — the material is the data. No derived statistic
// needed: a numeric column's values ARE a real numeric series already: this
// perceiver's whole job is picking a column and getting quoting right.
// See perceiver/text/material.js for the shared load/reduce contract.

import fs from "node:fs";

const parseCSV = (text) => {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
};

// -1 (not column 0) when nothing parses: "no numeric column" is a type
// error, never a null. Letting it fall through to column 0 turned a real
// absence of numeric data into a misleading string of empty-material gaps
// that read as "read more and it'll resolve" when no amount would.
const pickNumericColumn = (rows) => {
  const dataRows = rows.slice(1);
  let best = { index: -1, count: 0 };
  for (let c = 0; c < rows[0].length; c++) {
    let count = 0;
    for (const r of dataRows) if (r[c] != null && r[c].trim() !== "" && Number.isFinite(Number(r[c]))) count++;
    if (count > best.count) best = { index: c, count };
  }
  return best.index;
};

export const load = async (path) => parseCSV(fs.readFileSync(path, "utf8"));

export const reduce = (rows, { fraction = 1, column } = {}) => {
  const col = column ?? pickNumericColumn(rows);
  if (col === -1) throw new Error("no numeric column found — not a gap, a type error: this file has no real material for nul to ground");
  const dataRows = rows.slice(1);
  const readLen = Math.max(2, Math.floor(dataRows.length * fraction));
  const material = [];
  for (let i = 0; i < readLen; i++) {
    const v = Number(dataRows[i]?.[col]);
    if (Number.isFinite(v)) material.push(v);
  }
  return material;
};

export const columnName = (rows, column) => {
  const col = column ?? pickNumericColumn(rows);
  return col === -1 ? null : rows[0]?.[col];
};
