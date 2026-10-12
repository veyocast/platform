const mutableColumns = new Set(["status", "evidence", "production_route"]);

export function parseCaseInventory(input) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && (character === "," || character === "\n")) {
      row.push(cell.replace(/\r$/u, "")); cell = "";
      if (character === "\n") { rows.push(row); row = []; }
    } else cell += character;
  }
  if (quoted) throw new Error("Case inventory contains an unterminated CSV value.");
  if (cell || row.length) { row.push(cell.replace(/\r$/u, "")); rows.push(row); }
  const columns = rows.shift() ?? [];
  if (!columns.length || new Set(columns).size !== columns.length) throw new Error("Case inventory has invalid column names.");
  return rows.map(values => {
    if (values.length !== columns.length) throw new Error("Case inventory contains an incomplete CSV row.");
    return Object.fromEntries(columns.map((column, index) => [column, values[index]]));
  });
}

export function validateCaseInventory(currentText, originalText) {
  const original = parseCaseInventory(originalText), current = parseCaseInventory(currentText);
  if (original.length !== 1209 || current.length !== original.length) throw new Error("All 1209 original visual cases are required.");
  const ids = new Set();
  for (let index = 0; index < original.length; index++) {
    const source = original[index], row = current[index];
    if (!row.case_id || ids.has(row.case_id)) throw new Error("Case inventory contains a missing or duplicate original ID.");
    ids.add(row.case_id);
    for (const [column, value] of Object.entries(source)) {
      if (!mutableColumns.has(column) && row[column] !== value) throw new Error(`Original case changed: ${source.case_id}/${column}.`);
    }
  }
  const broadcast = current.filter(row => ["BROADCAST_PARITY", "BROADCAST_AND_CONTRACT"].includes(row.case_kind));
  const responsive = current.filter(row => row.case_id.startsWith("RESP-"));
  if (broadcast.length !== 548 || responsive.length !== 66) throw new Error("All 548 broadcast and 66 responsive cases are required.");
  return { originalCases: current.length, broadcastCases: broadcast.length, responsiveCases: responsive.length };
}
