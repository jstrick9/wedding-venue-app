import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

const FORBIDDEN_RUNTIME_DETAIL = /\b(?:supabase|vercel|brevo|postgrest|postgres|smtp|provider|localstorage|geoapify|openmaptiles|openstreetmap)\b|\bedge function\b|\bsql editor\b|\b(?:cloud|local) mode\b|\bbrowser (?:storage|data)\b|\bserver proxy\b/i;

const LOCATION_ATTRIBUTION_FILES = new Set([
  'components/AddressAutocomplete.tsx',
  'components/PlatformVenueMap.tsx',
]);
const LOCATION_ATTRIBUTION_LITERALS = new Set([
  'https://www.geoapify.com/',
  'https://openmaptiles.org/',
  'https://www.openstreetmap.org/copyright',
  'Powered by Geoapify',
  'OpenMapTiles',
  'OpenStreetMap contributors',
]);

function isApprovedInternalOrLegalLiteral(path: string, value: string): boolean {
  // Exact lowercase values are internal provider discriminants, never copy.
  if (value === 'supabase' || value === 'geoapify') return true;

  // The operator explicitly retained legally required location attribution in
  // Review #274. Keep the exception narrow: two UI files and formal attribution
  // links/text only, not explanatory product copy or error messages.
  const normalizedPath = path.split('\\').join('/');
  const relativePath = normalizedPath.slice(normalizedPath.lastIndexOf('/src/') + 5);
  if (!LOCATION_ATTRIBUTION_FILES.has(relativePath)) return false;
  return LOCATION_ATTRIBUTION_LITERALS.has(value)
    || (value.startsWith('<a href="https://www.geoapify.com/')
      && value.includes('Powered by Geoapify')
      && value.includes('OpenStreetMap contributors'));
}

function sourceFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory() && entry.name !== 'test') result.push(...sourceFiles(path));
    else if (entry.isFile() && ['.ts', '.tsx'].includes(extname(path)) && !/\.(?:test|spec)\.[^.]+$/.test(path)) result.push(path);
  }
  return result;
}

function isModuleSpecifier(node: ts.StringLiteralLike): boolean {
  return ts.isImportDeclaration(node.parent)
    || ts.isExportDeclaration(node.parent)
    || ts.isExternalModuleReference(node.parent);
}

function forbiddenLiterals(path: string): string[] {
  const text = readFileSync(path, 'utf8');
  const parsed = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hits: string[] = [];
  const recordIfForbidden = (value: string) => {
    if (
      value
      && !isApprovedInternalOrLegalLiteral(path, value)
      && FORBIDDEN_RUNTIME_DETAIL.test(value)
    ) hits.push(value);
  };
  const visit = (node: ts.Node) => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isModuleSpecifier(node)) {
      recordIfForbidden(node.text.trim());
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      recordIfForbidden(node.text.trim());
    } else if (ts.isJsxText(node)) {
      recordIfForbidden(node.text.replace(/\s+/g, ' ').trim());
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return hits;
}

describe('white-label runtime copy', () => {
  it('contains no infrastructure or hosting names in renderable source literals', () => {
    const root = resolve(process.cwd(), 'src');
    const violations = sourceFiles(root).flatMap((path) =>
      forbiddenLiterals(path).map((value) => `${relative(root, path)}: ${value}`),
    );
    expect(violations).toEqual([]);
  });
});
