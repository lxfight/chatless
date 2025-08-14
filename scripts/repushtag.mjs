#!/usr/bin/env node
import { execSync } from 'node:child_process';

function printUsageAndExit() {
  console.log('Usage: node scripts/repushtag.mjs <tag> [--message "msg"] [--ref <commit-ish>] [--remote <name>]');
  console.log('Example: node scripts/repushtag.mjs v0.2.0-alpha.1 --message "v0.2.0-alpha.1"');
  process.exit(1);
}

function parseArgs(argv) {
  const out = { tag: null, message: null, ref: 'HEAD', remote: 'origin' };
  const args = argv.slice(2);
  if (args.length === 0) return out;
  out.tag = args[0];
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === '--message' || a === '-m') { out.message = args[++i]; continue; }
    if (a === '--ref') { out.ref = args[++i] || 'HEAD'; continue; }
    if (a === '--remote') { out.remote = args[++i] || 'origin'; continue; }
  }
  return out;
}

function assertTag(tag) {
  if (!tag) {
    console.error('Error: tag is required.');
    printUsageAndExit();
  }
  const re = /^v\d+\.\d+\.\d+(?:[-.+][0-9A-Za-z-.]+)?$/; // allow prerelease/build
  if (!re.test(tag)) {
    console.error(`Error: invalid tag format: ${tag}. Expected like v1.2.3 or v1.2.3-alpha.1`);
    process.exit(1);
  }
}

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function hasLocalTag(tag) {
  try {
    execSync(`git rev-parse -q --verify refs/tags/${tag}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

try {
  const { tag, message, ref, remote } = parseArgs(process.argv);
  assertTag(tag);
  const msg = message || tag;

  // 1) delete remote tag if exists (ignore errors)
  try { run(`git push ${remote} :refs/tags/${tag}`); } catch (_) { /* ignore */ }

  // 2) delete local tag if exists
  if (hasLocalTag(tag)) {
    try { run(`git tag -d ${tag}`); } catch (_) { /* ignore */ }
  }

  // 3) create annotated tag at ref
  run(`git tag -a ${tag} -m "${msg.replace(/"/g, '\\"')}" ${ref}`);

  // 4) push tag
  run(`git push ${remote} ${tag}`);

  console.log('\n✅ Tag repushed successfully.');
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}

