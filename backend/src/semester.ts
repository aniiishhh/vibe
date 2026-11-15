/** Adapted from SameClass bot/src/domain/semester.ts at 3292dea.
 * ASU term codes are a backend detail; people supply semester names.
 */
const seasonDigits: Record<string, string> = { spring: '1', summer: '4', fall: '7', autumn: '7' };
export const semesterPattern = /^(?:2\d{2}[147]|(?:spring|summer|fall|autumn)\s+20\d{2}|20\d{2}\s+(?:spring|summer|fall|autumn))$/i;
export function asuTermCode(value: string): string {
  const text = value.trim().toLowerCase();
  if (!semesterPattern.test(text)) throw new Error('Choose a semester and year, such as Spring 2027.');
  if (/^2\d{2}[147]$/.test(text)) return text;
  const parts = text.split(/\s+/);
  const [year, season] = /^20/.test(parts[0]) ? parts : [parts[1], parts[0]];
  return `2${year.slice(2)}${seasonDigits[season]}`;
}
export function normalizeCourseTerms(input: Record<string, unknown>): Record<string, unknown> {
  return { ...input,
    ...(typeof input.term === 'string' ? { term: asuTermCode(input.term) } : {}),
    ...(Array.isArray(input.fallback_terms) ? { fallback_terms: input.fallback_terms.map(value => asuTermCode(String(value))) } : {}),
  };
}
