/*
  Cleanup icons in public/llm-provider-icon based on providers in src/lib/provider/catalog.ts
  Rules:
  - Keep only providers listed in catalog.ts (field id)
  - For each provider, keep a single icon with priority: svg > png > webp > jpeg > jpg
    (jpeg/jpg are only kept if none of svg/png/webp exists)
  - Remove any other files (aliases, *_dark, unrelated brands, etc.)
  - Canonicalize kept filename to `${id}.${ext}` in lowercase
  - Added: dry-run mode by default; pass --apply to actually modify files
  - Added: report missing icons for providers present in catalog but not in directory
*/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..');
const catalogPath = path.join(projectRoot, 'src', 'lib', 'provider', 'catalog.ts');
const iconsDir = path.join(projectRoot, 'public', 'llm-provider-icon');

function readCatalogIds(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const idRegex = /id:\s*'([^']+)'/g;
  const ids = new Set();
  let m;
  while ((m = idRegex.exec(content)) !== null) {
    ids.add(m[1]);
  }
  return ids;
}

function ensureDirExists(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`Directory not found: ${dir}`);
  }
}

function main() {
  ensureDirExists(iconsDir);
  const providerIds = readCatalogIds(catalogPath);
  const providerIdsLower = new Set(Array.from(providerIds, (id) => id.toLowerCase()));

  const priority = ['svg', 'png', 'webp', 'jpeg', 'jpg'];
  const applyChanges = process.argv.includes('--apply');

  const entries = fs.readdirSync(iconsDir);
  const idToFiles = new Map();
  const nonCatalog = [];

  for (const name of entries) {
    const fullPath = path.join(iconsDir, name);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;

    const ext = path.extname(name).slice(1).toLowerCase();
    const base = path.basename(name, path.extname(name));
    const baseLower = base.toLowerCase();

    if (providerIdsLower.has(baseLower)) {
      if (!idToFiles.has(baseLower)) idToFiles.set(baseLower, []);
      idToFiles.get(baseLower).push({ name, fullPath, ext, base, baseLower });
    } else {
      nonCatalog.push({ name, fullPath });
    }
  }

  const actions = [];

  // Report missing icons
  const presentIds = new Set(idToFiles.keys());
  for (const id of providerIdsLower) {
    if (!presentIds.has(id)) {
      actions.push(`MISSING: ${id}`);
    }
  }

  // Handle providers present in directory
  for (const [id, files] of idToFiles.entries()) {
    // Select best ext by priority
    files.sort((a, b) => priority.indexOf(a.ext) - priority.indexOf(b.ext));
    const keep = files.find((f) => priority.includes(f.ext)) || files[0];
    // Delete others
    for (const f of files) {
      if (f !== keep) {
        if (applyChanges) fs.unlinkSync(f.fullPath);
        actions.push(`DELETE duplicate: ${f.name}`);
      }
    }
    // Canonicalize filename: id.ext (lowercase)
    const targetName = `${id}.${keep.ext}`;
    if (keep.name !== targetName) {
      const targetPath = path.join(iconsDir, targetName);
      if (fs.existsSync(targetPath)) {
        if (applyChanges) fs.unlinkSync(keep.fullPath);
        actions.push(`DELETE (conflict): ${keep.name}`);
      } else {
        if (applyChanges) fs.renameSync(keep.fullPath, targetPath);
        actions.push(`RENAME: ${keep.name} -> ${targetName}`);
      }
    } else {
      actions.push(`KEEP: ${keep.name}`);
    }
  }

  // Remove all non-catalog files
  for (const f of nonCatalog) {
    if (applyChanges) fs.unlinkSync(f.fullPath);
    actions.push(`DELETE non-catalog: ${f.name}`);
  }

  // Report summary
  const summary = actions.reduce(
    (acc, line) => {
      if (line.startsWith('MISSING')) acc.missing += 1;
      if (line.startsWith('DELETE')) acc.deleted += 1;
      if (line.startsWith('RENAME')) acc.renamed += 1;
      if (line.startsWith('KEEP')) acc.kept += 1;
      return acc;
    },
    { deleted: 0, renamed: 0, kept: 0, missing: 0 }
  );

  console.log(actions.join('\n'));
  console.log(`\nSummary: kept=${summary.kept}, renamed=${summary.renamed}, deleted=${summary.deleted}, missing=${summary.missing}${applyChanges ? ' (APPLIED)' : ' (DRY-RUN)'}`);
}

try {
  main();
} catch (err) {
  console.error('Cleanup failed:', err && err.stack ? err.stack : err);
  process.exit(1);
}


