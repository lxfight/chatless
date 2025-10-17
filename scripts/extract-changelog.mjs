import { readFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';

function escapeRegex(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getArgValue(args, name, short) {
  const longIndex = args.indexOf(`--${name}`);
  if (longIndex !== -1) return args[longIndex + 1];
  if (short) {
    const shortIndex = args.indexOf(`-${short}`);
    if (shortIndex !== -1) return args[shortIndex + 1];
  }
  return undefined;
}

async function extractChangelogSection(options) {
  const changelogPath = resolvePath(options.path || 'CHANGELOG.md');
  let content;
  try {
    content = await readFile(changelogPath, 'utf8');
  } catch {
    return options.fallback;
  }

  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  // Match header like: ## [1.2.3] - 2025-01-01
  const version = (options.version || '').replace(/^v/i, '');
  if (!version) return options.fallback;

  const headerRegexes = [
    // ## [0.4.2] - ...
    new RegExp(`^##\\s*\\[\\s*${escapeRegex(version)}\\s*\\]`),
    // ## 0.4.2 - ...
    new RegExp(`^##\\s*${escapeRegex(version)}\\b`),
    // ## [v0.4.2] - ...
    new RegExp(`^##\\s*\\[\\s*v?\\s*${escapeRegex(version)}\\s*\\]`),
    // ## v0.4.2 - ...
    new RegExp(`^##\\s*v?\\s*${escapeRegex(version)}\\b`),
  ];
  let startIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (headerRegexes.some((re) => re.test(lines[i]))) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === -1) {
    // Not found: return fallback
    return options.fallback;
  }

  // Find next section start
  const nextHeaderRegex = /^##\s*\[/;
  let endIndex = lines.length;
  for (let j = startIndex + 1; j < lines.length; j += 1) {
    if (nextHeaderRegex.test(lines[j])) {
      endIndex = j;
      break;
    }
  }

  let section = lines.slice(startIndex + 1, endIndex).join('\n');
  // Trim leading/trailing blank lines
  section = section.replace(/^\s+|\s+$/g, '');

  if (!section) return options.fallback;
  return section;
}

async function main() {
  const args = process.argv.slice(2);
  const version = process.env.VERSION || getArgValue(args, 'version', 'v');
  const path = getArgValue(args, 'path', 'p') || 'CHANGELOG.md';
  const fallback = getArgValue(args, 'fallback', 'f') || '本次更新包含问题修复、性能改进与体验优化。';

  const result = await extractChangelogSection({ version, path, fallback });
  // Always output something (fallback guarantees content)
  process.stdout.write(`${result}\n`);
}

main().catch(() => {
  // As a safe guard, never fail the workflow; output fallback text
  const fallback = '本次更新包含问题修复、性能改进与体验优化。';
  process.stdout.write(`${fallback}\n`);
});


