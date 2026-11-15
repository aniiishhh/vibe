import { describe, expect, it } from 'vitest';
import { asuTermCode, normalizeCourseTerms } from '../src/semester.js';
import { schemas, tools } from '../src/research.js';
describe('ASU semester names at the tool boundary', () => {
  it('maps names, reversed names and legacy codes without a fixed year', () => {
    for (const [name, code] of [['Spring 2027','2271'],['SUMMER 2027','2274'],['Fall 2026','2267'],['2028 autumn','2287'],[' Spring 2024 ','2241'],['2271','2271']]) {
      expect(asuTermCode(name)).toBe(code);
      expect(normalizeCourseTerms(schemas.search_classes.parse({term:name,subject:'CSE',catalog_nbr:'511'})).term).toBe(code);
    }
  });
  it('normalizes syllabus fallbacks and accepts names on every course tool', () => {
    expect(normalizeCourseTerms(schemas.get_syllabus_evidence.parse({term:'Spring 2027',fallback_terms:['Fall 2026'],subject:'CSE',catalog_nbr:'511'}))).toMatchObject({term:'2271',fallback_terms:['2267']});
    expect(schemas.get_course_details.safeParse({term:'2027 spring',subject:'CSE',catalog_nbr:'511'}).success).toBe(true);
    expect(tools.find(t=>t.toolSpec?.name==='search_classes')?.toolSpec?.description).not.toContain('Require an explicit ASU term code');
  });
  it('rejects missing years, relative semesters and invalid codes instead of guessing', () => {
    for (const value of ['Spring','next semester','2026','Winter 2027','2272','1231','Spring 1999']) expect(()=>asuTermCode(value)).toThrow('semester and year');
  });
});
