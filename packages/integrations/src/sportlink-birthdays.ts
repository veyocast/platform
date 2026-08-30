import { createHash } from "node:crypto";

import ExcelJS from "exceljs";

import { extractSportlinkRecords } from "./sportlink-client";

const dutchMonths: Record<string, number> = {
  april: 4, apr: 4,
  augustus: 8, aug: 8,
  december: 12, dec: 12,
  februari: 2, feb: 2,
  januari: 1, jan: 1,
  juli: 7, jul: 7,
  juni: 6, jun: 6,
  maart: 3, mrt: 3,
  mei: 5,
  november: 11, nov: 11,
  oktober: 10, okt: 10,
  september: 9, sep: 9, sept: 9
};

export type SportlinkBirthday = {
  day: number;
  displayName: string;
  externalId: string;
  month: number;
  nextOccurrence: string;
  normalizedName: string;
  rawDate: string;
};
export type SportlinkTeamMember = {
  displayName: string;
  externalMemberCode: string | null;
  normalizedName: string;
  photoUrl: string | null;
  role: string | null;
  teamExternalId: string;
  teamName: string;
};
export type SportlinkBirthdayMatch = {
  birthday: SportlinkBirthday;
  member: SportlinkTeamMember | null;
  status: "ambiguous" | "matched" | "unmatched";
  teamAssignments: Array<{ externalId: string; name: string }>;
};
export type BirthdayImportField =
  | "birth_date" | "birth_year" | "first_name" | "full_name"
  | "last_name" | "member_code" | "middle_name" | "role" | "team";
export type BirthdayImportMapping = Readonly<Record<string, BirthdayImportField | null>>;
export type BirthdayImportCell = boolean | number | string | null;
export type ParsedBirthdayImport = {
  fileName: string;
  headers: string[];
  rows: Array<Record<string, BirthdayImportCell>>;
};
export type NormalizedBirthdayImportRow = {
  errors: string[];
  normalized: {
    birthDay: number | null;
    birthMonth: number | null;
    birthYear: number | null;
    displayName: string;
    externalMemberCode: string | null;
    normalizedName: string;
    role: string | null;
    team: string | null;
  };
  rowNumber: number;
  status: "conflict" | "duplicate" | "invalid" | "valid";
};

export function normalizeSportlinkPersonName(value: string) {
  return value.normalize("NFKC").trim().replace(/[\u2018\u2019]/gu, "'")
    .replace(/\s+/gu, " ").toLocaleLowerCase("nl-NL");
}

export function parseSportlinkBirthdayDate(
  value: unknown,
  options: { now?: Date; timezone?: string } = {}
) {
  const raw = scalar(value);
  if (!raw) return null;
  const normalized = raw.normalize("NFKC").trim().toLocaleLowerCase("nl-NL")
    .replace(/\./gu, "");
  let day: number | null = null;
  let month: number | null = null;
  const iso = normalized.match(/^\d{4}-(\d{1,2})-(\d{1,2})(?:[t\s].*)?$/u);
  const dayFirst = normalized.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.]\d{2,4})?(?:[t\s].*)?$/u);
  const textual = normalized.match(/^(\d{1,2})\s+([a-zé]+)(?:\s+\d{2,4})?$/u);
  const compactIso = normalized.match(/^\d{4}(\d{2})(\d{2})$/u);
  if (iso) {
    month = Number(iso[1]); day = Number(iso[2]);
  } else if (dayFirst) {
    day = Number(dayFirst[1]); month = Number(dayFirst[2]);
  } else if (textual) {
    day = Number(textual[1]); month = dutchMonths[textual[2] ?? ""] ?? null;
  } else if (compactIso) {
    month = Number(compactIso[1]); day = Number(compactIso[2]);
  }
  if (!day || !month || !validMonthDay(month, day)) return null;
  const today = datePartsInTimezone(options.now ?? new Date(), options.timezone ?? "Europe/Amsterdam");
  const nextOccurrence = nextValidOccurrence(today, month, day);
  return nextOccurrence ? { day, month, nextOccurrence, raw } : null;
}

export function mapSportlinkBirthdays(
  payload: unknown,
  options: { maxDays?: number; now?: Date; timezone?: string } = {}
): SportlinkBirthday[] {
  const now = options.now ?? new Date();
  const timezone = options.timezone ?? "Europe/Amsterdam";
  const maximum = Math.min(21, Math.max(1, Math.trunc(options.maxDays ?? 21)));
  const today = datePartsInTimezone(now, timezone);
  const unique = new Map<string, SportlinkBirthday>();
  for (const row of extractSportlinkRecords(payload)) {
    const displayName = scalar(row.volledigenaam ?? row.volledigeNaam ?? row.naam);
    const parsed = parseSportlinkBirthdayDate(
      row.verjaardag ?? row.geboortedatum ?? row.datum,
      { now, timezone }
    );
    if (!displayName || displayName.length > 160 || !parsed) continue;
    const days = daysBetween(today, dateOnlyParts(parsed.nextOccurrence));
    if (days < 0 || days > maximum) continue;
    const normalizedName = normalizeSportlinkPersonName(displayName);
    if (!normalizedName) continue;
    const externalId = stableId("birthday", `${normalizedName}|${parsed.month}|${parsed.day}`);
    unique.set(externalId, {
      day: parsed.day, displayName, externalId, month: parsed.month,
      nextOccurrence: parsed.nextOccurrence, normalizedName, rawDate: parsed.raw
    });
  }
  return [...unique.values()].sort((left, right) =>
    left.nextOccurrence.localeCompare(right.nextOccurrence) ||
    left.displayName.localeCompare(right.displayName, "nl-NL")
  );
}

export function mapSportlinkTeamMembers(
  payload: unknown,
  team: { externalId: string; name: string }
): SportlinkTeamMember[] {
  return extractSportlinkRecords(payload).flatMap((row) => {
    const displayName = scalar(
      row.volledigenaam ?? row.volledigeNaam ?? row.naam ?? row.lidnaam
    );
    if (!displayName || displayName.length > 160) return [];
    const normalizedName = normalizeSportlinkPersonName(displayName);
    if (!normalizedName) return [];
    return [{
      displayName,
      externalMemberCode: boundedScalar(row.lidcode ?? row.relatiecode ?? row.persooncode, 120),
      normalizedName,
      photoUrl: httpUrl(row.foto ?? row.lidfoto ?? row.afbeelding),
      role: boundedScalar(row.teampersoonrol ?? row.rol ?? row.functie, 80),
      teamExternalId: team.externalId,
      teamName: team.name
    }];
  });
}

export function matchSportlinkBirthdays(
  birthdays: readonly SportlinkBirthday[],
  members: readonly SportlinkTeamMember[]
): SportlinkBirthdayMatch[] {
  const membersByName = new Map<string, SportlinkTeamMember[]>();
  for (const member of members) {
    membersByName.set(member.normalizedName, [
      ...(membersByName.get(member.normalizedName) ?? []), member
    ]);
  }
  return birthdays.map((birthday) => {
    const candidates = membersByName.get(birthday.normalizedName) ?? [];
    if (!candidates.length) {
      return { birthday, member: null, status: "unmatched", teamAssignments: [] };
    }
    const byIdentity = new Map<string, SportlinkTeamMember[]>();
    for (const candidate of candidates) {
      const identity = candidate.externalMemberCode
        ? `code:${candidate.externalMemberCode}`
        : `unlinked:${candidate.teamExternalId}`;
      byIdentity.set(identity, [...(byIdentity.get(identity) ?? []), candidate]);
    }
    if (byIdentity.size !== 1) {
      return { birthday, member: null, status: "ambiguous", teamAssignments: [] };
    }
    const identity = [...byIdentity.values()][0] ?? [];
    if (!identity.length || (identity.length > 1 && !identity[0]?.externalMemberCode)) {
      return { birthday, member: null, status: "ambiguous", teamAssignments: [] };
    }
    const member = identity[0]!;
    const teamAssignments = [...new Map(identity.map((candidate) => [
      candidate.teamExternalId,
      { externalId: candidate.teamExternalId, name: candidate.teamName }
    ])).values()];
    return { birthday, member, status: "matched", teamAssignments };
  });
}

export async function parseBirthdayImportFile(
  fileName: string,
  input: Uint8Array
): Promise<ParsedBirthdayImport> {
  if (!input.byteLength) throw new Error("birthday_import_empty");
  if (input.byteLength > 8 * 1024 * 1024) throw new Error("birthday_import_too_large");
  const lower = fileName.toLocaleLowerCase("nl-NL");
  if (lower.endsWith(".csv")) {
    return parseCsvImport(fileName, new TextDecoder("utf-8", { fatal: true }).decode(input));
  }
  if (!lower.endsWith(".xlsx") || input[0] !== 0x50 || input[1] !== 0x4b) {
    throw new Error("birthday_import_invalid_format");
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(input) as never);
  if (workbook.worksheets.length > 8) throw new Error("birthday_import_too_many_sheets");
  const sheet = workbook.worksheets.find((entry) => entry.actualRowCount > 0);
  if (!sheet || sheet.actualRowCount > 10_001 || sheet.actualColumnCount > 75) {
    throw new Error("birthday_import_invalid_dimensions");
  }
  const headers = uniqueHeaders(Array.from({ length: sheet.actualColumnCount }, (_, index) =>
    safeCell(sheet.getRow(1).getCell(index + 1).value) || `Kolom ${index + 1}`
  ));
  const rows: Array<Record<string, BirthdayImportCell>> = [];
  for (let rowNumber = 2; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = Object.fromEntries(headers.map((header, index) => [
      header, importCell(row.getCell(index + 1).value)
    ]));
    if (Object.values(values).every((value) => value === null || value === "")) continue;
    rows.push(values);
  }
  return { fileName: safeFileName(fileName), headers, rows };
}

export function guessBirthdayImportMapping(headers: readonly string[]): BirthdayImportMapping {
  const claimed = new Set<BirthdayImportField>();
  return Object.fromEntries(headers.map((header) => {
    const normalized = normalizeHeader(header);
    const target = birthdayHeaderAliases.find(([field, aliases]) =>
      !claimed.has(field) && aliases.some((alias) => normalized === alias || normalized.includes(alias))
    )?.[0] ?? null;
    if (target) claimed.add(target);
    return [header, target];
  }));
}

export function normalizeBirthdayImportRows(
  rows: readonly Readonly<Record<string, BirthdayImportCell>>[],
  mapping: BirthdayImportMapping,
  now = new Date()
): NormalizedBirthdayImportRow[] {
  const seen = new Set<string>();
  return rows.map((source, index) => {
    const fields = new Map<BirthdayImportField, BirthdayImportCell>();
    for (const [header, target] of Object.entries(mapping)) {
      if (target) fields.set(target, source[header] ?? null);
    }
    const fullName = cleanImportText(fields.get("full_name"));
    const displayName = fullName || [
      cleanImportText(fields.get("first_name")), cleanImportText(fields.get("middle_name")),
      cleanImportText(fields.get("last_name"))
    ].filter(Boolean).join(" ");
    const normalizedName = normalizeSportlinkPersonName(displayName);
    const memberCode = cleanImportText(fields.get("member_code"));
    const role = cleanImportText(fields.get("role"));
    const team = cleanImportText(fields.get("team"));
    const birthDate = parseImportedBirthDate(fields.get("birth_date"));
    const birthYear = parseBirthYear(fields.get("birth_year") ?? birthDate?.year, now);
    const errors: string[] = [];
    if (!displayName || displayName.length > 160) errors.push("Naam ontbreekt of is te lang.");
    if (!birthYear) errors.push("Een betrouwbaar geboortejaar tussen 1901 en het huidige jaar is verplicht.");
    if (fields.has("birth_date") && !birthDate) errors.push("Geboortedatum is ongeldig.");
    if ([displayName, memberCode, role, team].some(isFormulaLike)) {
      errors.push("Formule-inhoud is niet toegestaan.");
    }
    const identity = memberCode ? `code:${memberCode}` : `name:${normalizedName}`;
    const duplicate = !errors.length && seen.has(identity);
    if (!errors.length) seen.add(identity);
    return {
      errors,
      normalized: {
        birthDay: birthDate?.day ?? null, birthMonth: birthDate?.month ?? null,
        birthYear, displayName, externalMemberCode: memberCode || null,
        normalizedName, role: role || null, team: team || null
      },
      rowNumber: index + 2,
      status: errors.length ? "invalid" : duplicate ? "duplicate" : "valid"
    };
  });
}

function parseCsvImport(fileName: string, text: string): ParsedBirthdayImport {
  if (text.includes("\0")) throw new Error("birthday_import_invalid_format");
  const firstLine = text.split(/\r?\n/u)[0] ?? "";
  const delimiter = (firstLine.match(/;/gu)?.length ?? 0) >=
    (firstLine.match(/,/gu)?.length ?? 0) ? ";" : ",";
  const records: string[][] = [];
  let field = ""; let row: string[] = []; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (!quoted && character === delimiter) {
      row.push(field); field = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); records.push(row); field = ""; row = [];
    } else field += character;
  }
  if (quoted) throw new Error("birthday_import_invalid_csv");
  if (field || row.length) { row.push(field); records.push(row); }
  const headerRow = records.shift();
  if (!headerRow || headerRow.length < 2 || headerRow.length > 75) {
    throw new Error("birthday_import_no_header");
  }
  if (records.length > 10_000) throw new Error("birthday_import_too_many_rows");
  const headers = uniqueHeaders(headerRow.map((value, index) => value.trim() || `Kolom ${index + 1}`));
  const rows = records.filter((values) => values.some((value) => value.trim())).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, safeCell(values[index] ?? "")]))
  );
  return { fileName: safeFileName(fileName), headers, rows };
}

function parseImportedBirthDate(value: unknown) {
  const raw = scalar(value);
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/u);
  const nl = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/u);
  const year = Number(iso?.[1] ?? nl?.[3]);
  const month = Number(iso?.[2] ?? nl?.[2]);
  const day = Number(iso?.[3] ?? nl?.[1]);
  return year && validMonthDay(month, day) ? { day, month, year } : null;
}
function parseBirthYear(value: unknown, now: Date) {
  const match = scalar(value)?.match(/^\d{4}$/u);
  const year = match ? Number(match[0]) : NaN;
  const currentYear = now.getUTCFullYear();
  return Number.isInteger(year) && year > 1900 && year <= currentYear ? year : null;
}
function datePartsInTimezone(value: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit", month: "2-digit", timeZone: timezone, year: "numeric"
    }).formatToParts(value);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((entry) => entry.type === type)?.value);
    return { day: part("day"), month: part("month"), year: part("year") };
  } catch {
    return { day: value.getUTCDate(), month: value.getUTCMonth() + 1, year: value.getUTCFullYear() };
  }
}
function nextValidOccurrence(today: { day: number; month: number; year: number }, month: number, day: number) {
  for (let year = today.year; year <= today.year + 8; year += 1) {
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getUTCMonth() + 1 !== month || candidate.getUTCDate() !== day) continue;
    const current = new Date(Date.UTC(today.year, today.month - 1, today.day));
    if (candidate >= current) return candidate.toISOString().slice(0, 10);
  }
  return null;
}
function daysBetween(left: { day: number; month: number; year: number }, right: { day: number; month: number; year: number }) {
  return Math.round((Date.UTC(right.year, right.month - 1, right.day) -
    Date.UTC(left.year, left.month - 1, left.day)) / 86_400_000);
}
function dateOnlyParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { day: day!, month: month!, year: year! };
}
function validMonthDay(month: number, day: number) {
  return Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 &&
    day >= 1 && day <= new Date(Date.UTC(2024, month, 0)).getUTCDate();
}
function stableId(namespace: string, value: string) {
  return createHash("sha256").update(`${namespace}:${value}`).digest("hex").slice(0, 40);
}
function scalar(value: unknown) {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
function boundedScalar(value: unknown, maximum: number) {
  const result = scalar(value); return result && result.length <= maximum ? result : null;
}
function httpUrl(value: unknown) {
  const raw = scalar(value); if (!raw) return null;
  try { const url = new URL(raw); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; }
  catch { return null; }
}
function normalizeHeader(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("nl-NL")
    .replace(/[^a-z0-9]+/gu, " ").trim();
}
const birthdayHeaderAliases: Array<[BirthdayImportField, string[]]> = [
  ["full_name", ["volledige naam", "volledigenaam", "naam", "lidnaam"]],
  ["first_name", ["voornaam", "roepnaam"]],
  ["middle_name", ["tussenvoegsel", "voorvoegsel"]],
  ["last_name", ["achternaam", "familienaam"]],
  ["member_code", ["relatiecode", "lidcode", "persooncode"]],
  ["birth_date", ["geboortedatum", "geboorte datum"]],
  ["birth_year", ["geboortejaar", "geboorte jaar"]],
  ["team", ["team", "teamnaam"]],
  ["role", ["rol", "functie", "teampersoonrol"]]
];
function cleanImportText(value: unknown) {
  return (scalar(value) ?? "").normalize("NFKC").replace(/\s+/gu, " ").slice(0, 160);
}
function isFormulaLike(value: string) {
  return /^[-=+@]/u.test(value.trim());
}
function safeFileName(value: string) {
  const pathSafe = value.normalize("NFKC").replace(/[\\/]/gu, "_");
  return Array.from(pathSafe, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127 ? "_" : character;
  }).join("").slice(0, 180);
}
function safeCell(value: unknown) { return scalar(value)?.slice(0, 1_000) ?? ""; }
function importCell(value: ExcelJS.CellValue): BirthdayImportCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (["string", "number", "boolean"].includes(typeof value)) {
    return value as string | number | boolean;
  }
  if (typeof value !== "object") return null;
  if ("result" in value) return importCell(value.result as ExcelJS.CellValue);
  if ("text" in value && typeof value.text === "string") return value.text.slice(0, 1_000);
  return null;
}
function uniqueHeaders(values: readonly string[]) {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const safe = value.slice(0, 160); const count = (seen.get(safe) ?? 0) + 1;
    seen.set(safe, count); return count === 1 ? safe : `${safe} (${count})`;
  });
}
