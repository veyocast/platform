/* eslint-disable no-var, prefer-spread -- This exact function is serialized into the ES5-only LG document. */
/** Interpret only numeric CSS math from the locked Sites stylesheet. No eval or CSS mutation at source. */
export function normalizeLgSitesCss(css: string, width: number, height: number, variables?: Record<string, string>): string {
  // Chromium 79 does not understand :is/:where. Expand only selector preludes
  // in the trusted stylesheet, retaining rule order and bounded combinations.
  function splitSelectors(value: string): string[] {
    var parts: string[] = []; var start = 0; var depth = 0; var bracket = 0; var quote = "";
    for (var index = 0; index < value.length; index += 1) {
      var character = value.charAt(index);
      if (quote) { if (character === quote && value.charAt(index - 1) !== "\\") quote = ""; continue; }
      if (character === "\"" || character === "'") { quote = character; continue; }
      if (character === "[") bracket += 1; else if (character === "]") bracket -= 1;
      else if (!bracket && character === "(") depth += 1; else if (!bracket && character === ")") depth -= 1;
      else if (character === "," && !depth && !bracket) { parts.push(value.slice(start,index)); start = index + 1; }
    }
    parts.push(value.slice(start)); return parts;
  }
  function expandSelector(value: string): string[] {
    var pending = [value]; var result: string[] = []; var steps = 0;
    while (pending.length) {
      steps += 1; if (steps > 256 || pending.length + result.length > 128) return [value];
      var current = pending.shift()!; var pattern = /:(?:is|where)\(/g; var match = pattern.exec(current);
      if (!match) { result.push(current); continue; }
      var depth = 1; var index = pattern.lastIndex; var quote = "";
      for (; index < current.length && depth; index += 1) {
        var character = current.charAt(index);
        if (quote) { if (character === quote && current.charAt(index-1) !== "\\") quote = ""; continue; }
        if (character === "\"" || character === "'") quote = character;
        else if (character === "(") depth += 1; else if (character === ")") depth -= 1;
      }
      if (depth) return [value];
      var choices = splitSelectors(current.slice(pattern.lastIndex,index-1));
      for (var choice = 0; choice < choices.length; choice += 1) pending.push(current.slice(0,match.index) + choices[choice]!.trim() + current.slice(index));
    }
    return result;
  }
  css = css.replace(/([^{}]+)\{/g,function (match,prelude) {
    if (prelude.trim().charAt(0) === "@" || !/:(?:is|where)\(/.test(prelude)) return match;
    var selectors = splitSelectors(prelude); var expanded: string[] = [];
    for (var index = 0; index < selectors.length; index += 1) expanded = expanded.concat(expandSelector(selectors[index]!));
    return expanded.join(",") + "{";
  });
  var knownVariables = variables || {};
  var normalized = css.replace(/(-?(?:\d+\.?\d*|\.\d+))(cqw|cqh|cqmin|cqmax)\b/g, function (_match, number, unit) {
    var basis = unit === "cqw" ? width : unit === "cqh" ? height : unit === "cqmin" ? Math.min(width, height) : Math.max(width, height);
    return String(Math.round(Number(number) * basis / 100 * 100000) / 100000) + "px";
  });
  function color(input: string): [number, number, number, number] | null {
    var hex = /^#([a-f0-9]{3,8})$/i.exec(input.trim());
    if (hex) {
      var value = hex[1]!;
      if (value.length === 3 || value.length === 4) value = value.split("").map(function (digit) { return digit + digit; }).join("");
      if (value.length !== 6 && value.length !== 8) return null;
      return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16), value.length === 8 ? parseInt(value.slice(6, 8), 16) / 255 : 1];
    }
    if (input.trim() === "transparent") return [0, 0, 0, 0];
    var rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*\.?\d+))?\s*\)$/i.exec(input.trim());
    return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])] : null;
  }
  function replaceVariables(input: string, depth: number): string {
    if (depth > 12) return input;
    return input.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, function (match, name, fallback) {
      var value = Object.prototype.hasOwnProperty.call(knownVariables, name) ? knownVariables[name] : fallback;
      return value === undefined || value === "" ? match : replaceVariables(String(value), depth + 1);
    });
  }
  function mix(expression: string): string | null {
    var input = replaceVariables(expression, 0);
    var parts = /^color-mix\(\s*in\s+srgb\s*,\s*(#[a-f0-9]{3,8}|rgba?\([^()]*\)|transparent)(?:\s+(\d*\.?\d+)%)?\s*,\s*(#[a-f0-9]{3,8}|rgba?\([^()]*\)|transparent)(?:\s+(\d*\.?\d+)%)?\s*\)$/i.exec(input);
    if (!parts) return null;
    var first = color(parts[1]!); var second = color(parts[3]!);
    if (!first || !second) return null;
    var a = parts[2] === undefined ? parts[4] === undefined ? 50 : 100 - Number(parts[4]) : Number(parts[2]);
    var b = parts[4] === undefined ? 100 - a : Number(parts[4]);
    if (a < 0 || b < 0 || a + b <= 0 || a > 100 || b > 100) return null;
    var total = a + b; var alpha = (first[3] * a + second[3] * b) / total;
    var channels = [0, 1, 2].map(function (index) { return alpha ? Math.round((first![index]! * first![3] * a + second![index]! * second![3] * b) / total / alpha) : 0; });
    return "rgba(" + channels.join(",") + "," + String(Math.round(alpha * Math.min(1, total / 100) * 100000) / 100000) + ")";
  }
  type Quantity = { amount: number; unit: string };
  function calculate(expression: string): string | null {
    var input = replaceVariables(expression, 0); var index = 0; var steps = 0;
    function space() { while (/\s/.test(input.charAt(index)) && index < input.length) index += 1; }
    function atom(): Quantity | null {
      steps += 1; if (steps > 1000) return null;
      space(); var sign = 1;
      if (input.charAt(index) === "+" || input.charAt(index) === "-") { if (input.charAt(index++) === "-") sign = -1; }
      space(); var result: Quantity | null = null;
      if (input.charAt(index) === "(") { index += 1; result = sum(); space(); if (input.charAt(index++) !== ")") return null; }
      else {
        var number = /^(\d+\.?\d*|\.\d+)(px|em|rem|deg|s|ms|%)?\b/.exec(input.slice(index));
        // Unitless fractions end at punctuation, so they must not require a word boundary.
        if (!number) number = /^(\d+\.?\d*|\.\d+)(px|em|rem|deg|s|ms|%)?(?=[\s),+*/-]|$)/.exec(input.slice(index));
        if (number) { index += number[0].length; result = { amount: Number(number[1]), unit: number[2] || "" }; }
        else {
          var name = /^(calc|min|max|clamp)\(/.exec(input.slice(index));
          if (!name) return null;
          index += name[0].length; var values: Quantity[] = []; var next = sum();
          if (!next) return null; values.push(next); space();
          while (input.charAt(index) === ",") { index += 1; next = sum(); if (!next) return null; values.push(next); space(); }
          if (input.charAt(index++) !== ")" || values.some(function (value) { return value.unit !== values[0]!.unit; })) return null;
          if (name[1] === "calc") { if (values.length !== 1) return null; result = values[0]!; }
          else if (name[1] === "clamp") { if (values.length !== 3) return null; result = { amount: Math.max(values[0]!.amount, Math.min(values[1]!.amount, values[2]!.amount)), unit: values[0]!.unit }; }
          else result = { amount: Math[name[1] as "min" | "max"].apply(Math, values.map(function (value) { return value.amount; })), unit: values[0]!.unit };
        }
      }
      return result ? { amount: result.amount * sign, unit: result.unit } : null;
    }
    function product(): Quantity | null {
      var result = atom(); if (!result) return null; space();
      while (input.charAt(index) === "*" || input.charAt(index) === "/") {
        var operator = input.charAt(index++); var right = atom(); if (!right) return null;
        if (operator === "*") { if (result.unit && right.unit) return null; result = { amount: result.amount * right.amount, unit: result.unit || right.unit }; }
        else { if (!right.amount || right.unit && right.unit !== result.unit) return null; result = { amount: result.amount / right.amount, unit: right.unit ? "" : result.unit }; }
        space();
      }
      return result;
    }
    function sum(): Quantity | null {
      var result = product(); if (!result) return null; space();
      while (input.charAt(index) === "+" || input.charAt(index) === "-") {
        var operator = input.charAt(index++); var right = product(); if (!right) return null;
        if (result.unit !== right.unit) return null;
        result = { amount: result.amount + (operator === "+" ? right.amount : -right.amount), unit: result.unit }; space();
      }
      return result;
    }
    var value = sum(); space();
    return value && index === input.length && isFinite(value.amount) ? String(Math.round(value.amount * 100000) / 100000) + value.unit : null;
  }
  var pattern = /\b(calc|min|max|clamp|color-mix)\(/g; var match: RegExpExecArray | null; var output = ""; var previous = 0;
  while ((match = pattern.exec(normalized))) {
    // minmax(), CSS names and custom properties are not numeric math functions.
    if (match.index > 0 && /[\w-]/.test(normalized.charAt(match.index - 1))) continue;
    var end = pattern.lastIndex; var depth = 1;
    while (end < normalized.length && depth) { if (normalized.charAt(end) === "(") depth += 1; if (normalized.charAt(end) === ")") depth -= 1; end += 1; }
    if (depth) break;
    var expression = normalized.slice(match.index, end); var value = match[1] === "color-mix" ? mix(expression) : calculate(expression);
    output += normalized.slice(previous, match.index) + (value === null ? expression : value); previous = end; pattern.lastIndex = end;
  }
  return output + normalized.slice(previous);
}

/** Function body contains only ES5 syntax after TypeScript erases annotations. */
export function lgSitesCssScript() {
  return "var normalizeLgSitesCss = " + normalizeLgSitesCss.toString() + ";";
}
