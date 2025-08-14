import https from 'https';
import { URL } from 'url';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      method: 'GET',
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: { 'User-Agent': 'chatless-updater-verify' }
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(`Invalid JSON from ${url}`)); }
        } else {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

try {
  let expected = process.env.EXPECTED_VERSION;
  if (!expected) throw new Error('EXPECTED_VERSION is required');
  if (expected.startsWith('refs/tags/')) {
    expected = expected.replace('refs/tags/', '');
  }
  if (expected.startsWith('v')) expected = expected.slice(1);
  const endpointsEnv = process.env.ENDPOINTS || '';
  const endpoints = endpointsEnv.split('\n').map(s => s.trim()).filter(Boolean);
  if (endpoints.length === 0) throw new Error('ENDPOINTS is required');

  let ok = true;
  for (const ep of endpoints) {
    console.log(`🔎 Fetching ${ep}`);
    const json = await fetchJson(ep);
    const version = json.version || json.name?.replace(/^v/, '') || '';
    if (version !== expected) {
      console.error(`❌ Version mismatch for ${ep}: got ${version}, expected ${expected}`);
      ok = false;
    }
    // 简要校验至少包含一个平台条目
    const platforms = json.platforms || {};
    const hasAny = Object.values(platforms).some((p) => p && p.url && p.signature);
    if (!hasAny) {
      console.error(`❌ No valid platform entries with url+signature in ${ep}`);
      ok = false;
    }
  }
  if (!ok) process.exit(1);
  console.log('✅ Updater endpoints verified');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

