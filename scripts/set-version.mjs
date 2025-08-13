import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assertSemver(v) {
  const r = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;
  if (!r.test(v)) throw new Error(`Invalid semver: ${v}`);
}

try {
  const version = process.env.VERSION;
  if (!version) throw new Error("VERSION env is required");
  assertSemver(version);

  // package.json
  const pkgPath = path.join(__dirname, "..", "package.json");
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkgJson.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2) + "\n");

  // src-tauri/tauri.conf.json
  const tauriPath = path.join(__dirname, "..", "src-tauri", "tauri.conf.json");
  const tauriJson = JSON.parse(fs.readFileSync(tauriPath, "utf8"));
  tauriJson.version = version;
  fs.writeFileSync(tauriPath, JSON.stringify(tauriJson, null, 2) + "\n");

  console.log(`Version set to ${version} in package.json and tauri.conf.json`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

