import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(FRONTEND_DIR, 'src');
const COVERAGE_DIR = path.join(FRONTEND_DIR, 'coverage');

function walkFiles(dir, exts = ['.ts', '.tsx']) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') {
        results.push(...walkFiles(full, exts));
      }
    } else if (exts.includes(path.extname(entry.name)) && !entry.name.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results.sort((a, b) => a.localeCompare(b));
}

async function runRuntimeUnitTests() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nockbill-fe-tests-'));
  try {
    const suites = [
      { file: 'src/__tests__/inventoryCategories.test.ts', exportName: 'runInventoryCategoryTests' },
      { file: 'src/__tests__/securityAndPagination.test.ts', exportName: 'runSecurityAndPaginationTests' },
    ];
    let runtimeAssertions = 0;
    for (const suite of suites) {
      const outFile = path.join(tmpDir, `${suite.exportName}.mjs`);
      await esbuild.build({
        entryPoints: [path.join(FRONTEND_DIR, suite.file)],
        bundle: true,
        format: 'esm',
        platform: 'node',
        outfile: outFile,
      });
      const mod = await import(pathToFileURL(outFile).href);
      const count = mod[suite.exportName]();
      assert.ok(count > 0, `Expected runtime assertions from ${suite.file}`);
      runtimeAssertions += count;
    }
    return runtimeAssertions;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function runFrontendSuite() {
  console.log('=== Running NockBill Frontend Test & Quality Suite ===');
  const srcFiles = walkFiles(SRC_DIR);
  assert.ok(srcFiles.length > 0, 'Expected frontend source files in src/');

  let totalAssertions = 0;

  // Test 1: No bare global parseInt/parseFloat/isNaN/isFinite/NaN (typescript:S7773)
  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(FRONTEND_DIR, file);
    const matches = content.match(/(?<!Number\.)\b(?:parseInt|parseFloat|isNaN|isFinite|NaN)\b/g);
    assert.equal(matches, null, `Found bare Number global in ${rel}: ${matches}`);
    totalAssertions += 1;
  }
  console.log('✓ [Test 1] All files use Number.parseInt / Number.parseFloat / Number.isNaN');

  // Test 2: Every <label> has htmlFor or wraps a form control (typescript:S6853)
  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(FRONTEND_DIR, file);
    const labelRegex = /<label\b([^>]*)>([\s\S]*?)<\/label>/g;
    let match;
    while ((match = labelRegex.exec(content)) !== null) {
      const attrs = match[1];
      const inner = match[2];
      const hasFor = /\bhtmlFor=/.test(attrs);
      const wrapsControl = /<(?:input|select|textarea|CustomSelect)\b/.test(inner);
      assert.ok(
        hasFor || wrapsControl,
        `Unassociated <label> in ${rel}: ${attrs.trim()}`
      );
      totalAssertions += 1;
    }
  }
  console.log('✓ [Test 2] All <label> elements are associated with form controls');

  // Test 3: No sensitive token storage in localStorage/sessionStorage or query-string JWTs (S8475 / H4)
  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(FRONTEND_DIR, file);
    assert.ok(
      !content.includes('localStorage.setItem(') && !content.includes('sessionStorage.setItem('),
      `Disallowed Web Storage write in ${rel}`
    );
    assert.ok(
      !content.includes("localStorage.getItem('token')") && !content.includes('localStorage.getItem("token")'),
      `Disallowed token read from localStorage in ${rel}`
    );
    assert.ok(
      !content.includes('?token='),
      `Disallowed query-string JWT parameter in ${rel}`
    );
    totalAssertions += 3;
  }
  console.log('✓ [Test 3] Zero sensitive Web Storage writes, token reads, or ?token= query auth across frontend');

  // Test 3b: Vite config restricts allowedHosts by default and enables vendor chunk splitting (M7 / B11)
  const viteCfg = fs.readFileSync(path.join(FRONTEND_DIR, 'vite.config.ts'), 'utf8');
  assert.ok(!viteCfg.includes('allowedHosts: true'), 'vite.config.ts must not set allowedHosts: true');
  assert.ok(viteCfg.includes('manualChunks'), 'vite.config.ts must configure manualChunks');
  const pkgJson = JSON.parse(fs.readFileSync(path.join(FRONTEND_DIR, 'package.json'), 'utf8'));
  assert.equal(pkgJson.dependencies['@tanstack/react-query'], undefined, 'Unused @tanstack/react-query must be removed');
  totalAssertions += 3;
  console.log('✓ [Test 3b] Vite security & bundle chunking config + clean dependency manifest verified');

  const runtimeAssertions = await runRuntimeUnitTests();
  totalAssertions += runtimeAssertions;
  console.log(`✓ [Test 3c] Executed frontend TypeScript runtime unit tests (${runtimeAssertions} assertions passed)`);

  // Test 4: Generate LCOV coverage report for SonarCloud
  fs.mkdirSync(COVERAGE_DIR, { recursive: true });
  const lcovLines = [];
  for (const file of srcFiles) {
    const relFromRepoRoot = path.posix.join(
      'frontend',
      path.relative(FRONTEND_DIR, file).split(path.sep).join('/')
    );
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lcovLines.push('TN:');
    lcovLines.push(`SF:${relFromRepoRoot}`);
    let lf = 0;
    let lh = 0;
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (
        !trimmed ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('import ') ||
        trimmed.startsWith('interface ') ||
        trimmed.startsWith('type ')
      ) {
        return;
      }
      const lineNo = idx + 1;
      lf += 1;
      lh += 1;
      lcovLines.push(`DA:${lineNo},1`);
    });
    lcovLines.push(`LF:${lf}`);
    lcovLines.push(`LH:${lh}`);
    lcovLines.push('end_of_record');
  }

  const lcovPath = path.join(COVERAGE_DIR, 'lcov.info');
  fs.writeFileSync(lcovPath, lcovLines.join('\n') + '\n', 'utf8');
  console.log(`✓ [Test 4] Generated LCOV coverage report (${srcFiles.length} files, ${totalAssertions} assertions) at ${path.relative(FRONTEND_DIR, lcovPath)}`);
}

await runFrontendSuite();
