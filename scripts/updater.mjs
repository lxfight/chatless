import { Octokit } from "@octokit/rest";

const UPDATE_JSON_FILE = "update.json";
const UPDATE_JSON_PROXY = "update-proxy.json";

const ALPHA_TAG_NAME = "updater-alpha";
const ALPHA_UPDATE_JSON_FILE = "update.json";
const ALPHA_UPDATE_JSON_PROXY = "update-proxy.json";

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required");
  }

  const { owner, repo } = resolveRepo();
  const octokit = new Octokit({ auth: token });

  const explicitTag = process.env.RELEASE_TAG;
  const tags = explicitTag
    ? [{ name: explicitTag }]
    : await fetchAllTags(octokit, owner, repo);

  const stableTagRegex = /^v\d+\.\d+\.\d+$/;
  const preReleaseRegex = /^v\d+\.\d+\.\d+-(alpha|beta|rc|pre)(\.[0-9]+)?$/i;

  for (const t of tags) {
    const isAlpha = preReleaseRegex.test(t.name);
    const isStable = stableTagRegex.test(t.name);
    if (!isAlpha && !isStable) continue;
    await processRelease(octokit, { owner, repo }, t, isAlpha);
  }
}

function resolveRepo() {
  const envRepo = process.env.GITHUB_REPOSITORY;
  if (!envRepo) {
    throw new Error(
      "GITHUB_REPOSITORY is required (format: owner/repo). This script is intended to run in GitHub Actions."
    );
  }
  const [owner, repo] = envRepo.split("/");
  if (!owner || !repo) {
    throw new Error("Invalid GITHUB_REPOSITORY env value");
  }
  return { owner, repo };
}

async function fetchAllTags(octokit, owner, repo) {
  const perPage = 100;
  let page = 1;
  const all = [];
  while (true) {
    const { data } = await octokit.repos.listTags({ owner, repo, per_page: perPage, page });
    all.push(...data);
    if (data.length < perPage) break;
    page += 1;
  }
  return all;
}

async function processRelease(octokit, options, tag, isAlpha) {
  try {
    const { data: release } = await octokit.repos.getReleaseByTag({ ...options, tag: tag.name });

    const updateData = createEmptyUpdate(tag.name, release.body);

    const fillTasks = release.assets.map(async (asset) => {
      const { name, browser_download_url } = asset;

      // Windows x64
      if (name.endsWith("x64-setup.exe")) {
        updateData.platforms.win64.url = browser_download_url;
        updateData.platforms["windows-x86_64"].url = browser_download_url;
      }
      if (name.endsWith("x64-setup.exe.sig")) {
        const sig = await getSignature(browser_download_url);
        updateData.platforms.win64.signature = sig;
        updateData.platforms["windows-x86_64"].signature = sig;
      }

      // Windows x86
      if (name.endsWith("x86-setup.exe")) {
        updateData.platforms["windows-x86"].url = browser_download_url;
        updateData.platforms["windows-i686"].url = browser_download_url;
      }
      if (name.endsWith("x86-setup.exe.sig")) {
        const sig = await getSignature(browser_download_url);
        updateData.platforms["windows-x86"].signature = sig;
        updateData.platforms["windows-i686"].signature = sig;
      }

      // Windows ARM64
      if (name.endsWith("arm64-setup.exe")) {
        updateData.platforms["windows-aarch64"].url = browser_download_url;
      }
      if (name.endsWith("arm64-setup.exe.sig")) {
        const sig = await getSignature(browser_download_url);
        updateData.platforms["windows-aarch64"].signature = sig;
      }

      // macOS Intel
      if (name.endsWith(".app.tar.gz") && !name.includes("aarch") && !name.includes("arm64")) {
        updateData.platforms.darwin.url = browser_download_url;
        updateData.platforms["darwin-intel"].url = browser_download_url;
        updateData.platforms["darwin-x86_64"].url = browser_download_url;
        // 兼容 Apple Silicon：通用包亦可供 darwin-aarch64 使用
        updateData.platforms["darwin-aarch64"].url = browser_download_url;
      }
      if (name.endsWith(".app.tar.gz.sig") && !name.includes("aarch") && !name.includes("arm64")) {
        const sig = await getSignature(browser_download_url);
        updateData.platforms.darwin.signature = sig;
        updateData.platforms["darwin-intel"].signature = sig;
        updateData.platforms["darwin-x86_64"].signature = sig;
        // 同步写入 Apple Silicon 签名
        updateData.platforms["darwin-aarch64"].signature = sig;
      }

      // macOS Apple Silicon (aarch64)
      if (name.endsWith("aarch64.app.tar.gz")) {
        updateData.platforms["darwin-aarch64"].url = browser_download_url;
      }
      if (name.endsWith("aarch64.app.tar.gz.sig")) {
        const sig = await getSignature(browser_download_url);
        updateData.platforms["darwin-aarch64"].signature = sig;
      }

      // macOS Apple Silicon (arm64) - 新增支持
      if (name.endsWith("arm64.app.tar.gz")) {
        updateData.platforms["darwin-aarch64"].url = browser_download_url;
      }
      if (name.endsWith("arm64.app.tar.gz.sig")) {
        const sig = await getSignature(browser_download_url);
        updateData.platforms["darwin-aarch64"].signature = sig;
      }

      // macOS Intel (x64) - 新增支持
      if (name.endsWith("x64.app.tar.gz")) {
        updateData.platforms.darwin.url = browser_download_url;
        updateData.platforms["darwin-intel"].url = browser_download_url;
        updateData.platforms["darwin-x86_64"].url = browser_download_url;
      }
      if (name.endsWith("x64.app.tar.gz.sig")) {
        const sig = await getSignature(browser_download_url);
        updateData.platforms.darwin.signature = sig;
        updateData.platforms["darwin-intel"].signature = sig;
        updateData.platforms["darwin-x86_64"].signature = sig;
      }

      // Linux (common patterns)
      if (name.endsWith(".AppImage.tar.gz") || name.endsWith("linux-x86_64.tar.gz") || name.endsWith("linux-aarch64.tar.gz")) {
        if (name.includes("aarch64") || name.includes("arm64")) {
          updateData.platforms["linux-aarch64"].url = browser_download_url;
        } else if (name.includes("i686") || name.includes("x86")) {
          updateData.platforms["linux-i686"].url = browser_download_url;
          updateData.platforms["linux-x86"].url = browser_download_url;
        } else {
          updateData.platforms["linux-x86_64"].url = browser_download_url;
        }
        updateData.platforms.linux.url = updateData.platforms.linux.url || browser_download_url;
      }
      if (name.endsWith(".AppImage.tar.gz.sig") || name.endsWith("linux-x86_64.tar.gz.sig") || name.endsWith("linux-aarch64.tar.gz.sig")) {
        const sig = await getSignature(browser_download_url);
        if (name.includes("aarch64") || name.includes("arm64")) {
          updateData.platforms["linux-aarch64"].signature = sig;
        } else if (name.includes("i686") || name.includes("x86")) {
          updateData.platforms["linux-i686"].signature = sig;
          updateData.platforms["linux-x86"].signature = sig;
        } else {
          updateData.platforms["linux-x86_64"].signature = sig;
        }
        updateData.platforms.linux.signature = updateData.platforms.linux.signature || sig;
      }
    });

    await Promise.allSettled(fillTasks);

    // 清理未解析的平台
    Object.entries(updateData.platforms).forEach(([key, value]) => {
      if (!value.url) delete updateData.platforms[key];
    });

    const updateDataProxy = makeProxyData(updateData);

    // 选择目标 release（稳定：当前版本；预发布：updater-alpha 固定通道）
    const jsonFile = isAlpha ? ALPHA_UPDATE_JSON_FILE : UPDATE_JSON_FILE;
    const proxyFile = isAlpha ? ALPHA_UPDATE_JSON_PROXY : UPDATE_JSON_PROXY;

    let targetRelease;
    if (isAlpha) {
      targetRelease = await getOrCreateRelease(octokit, options, ALPHA_TAG_NAME, true);
    } else {
      targetRelease = release; // 将 update.json 直接上传到当前稳定版的 Release
    }

    // 删除同名旧资产
    for (const asset of targetRelease.assets) {
      if (asset.name === jsonFile || asset.name === proxyFile) {
        try {
          await octokit.repos.deleteReleaseAsset({ ...options, asset_id: asset.id });
        } catch (e) {
          console.warn(`Delete asset failed (${asset.name}):`, e.message);
        }
      }
    }

    // 上传新的 JSON 资产
    await uploadJsonAsset(octokit, options, targetRelease.id, jsonFile, updateData);
    await uploadJsonAsset(octokit, options, targetRelease.id, proxyFile, updateDataProxy);

    console.log(
      `Uploaded ${isAlpha ? "alpha" : "stable"} update files to ${isAlpha ? ALPHA_TAG_NAME : tag.name}`
    );
  } catch (error) {
    if (error.status === 404) {
      console.log(`Release not found for tag: ${tag.name}, skipping...`);
    } else {
      console.error(`Failed to process tag ${tag.name}:`, error.message);
    }
  }
}

function createEmptyUpdate(tagName, releaseBody) {
  const normalizedVersion = typeof tagName === "string" && tagName.startsWith("v")
    ? tagName.slice(1)
    : tagName;

  return {
    version: normalizedVersion,
    notes: releaseBody || "",
    pub_date: new Date().toISOString(),
    platforms: {
      win64: { signature: "", url: "" },
      linux: { signature: "", url: "" },
      darwin: { signature: "", url: "" },
      "darwin-aarch64": { signature: "", url: "" },
      "darwin-intel": { signature: "", url: "" },
      "darwin-x86_64": { signature: "", url: "" },
      "linux-x86_64": { signature: "", url: "" },
      "linux-x86": { signature: "", url: "" },
      "linux-i686": { signature: "", url: "" },
      "linux-aarch64": { signature: "", url: "" },
      "linux-armv7": { signature: "", url: "" },
      "windows-x86_64": { signature: "", url: "" },
      "windows-aarch64": { signature: "", url: "" },
      "windows-x86": { signature: "", url: "" },
      "windows-i686": { signature: "", url: "" }
    }
  };
}

function makeProxyData(updateData) {
  const clone = JSON.parse(JSON.stringify(updateData));
  const prefix = process.env.UPDATER_PROXY_PREFIX || "";
  for (const [key, value] of Object.entries(clone.platforms)) {
    if (!value.url) continue;
    clone.platforms[key].url = prefix ? `${prefix}${value.url}` : value.url;
  }
  return clone;
}

async function getOrCreateRelease(octokit, options, tag, prerelease) {
  try {
    const { data } = await octokit.repos.getReleaseByTag({ ...options, tag });
    return data;
  } catch (error) {
    if (error.status === 404) {
      const { data } = await octokit.repos.createRelease({
        ...options,
        tag_name: tag,
        name: prerelease ? "Auto-update Alpha Channel" : "Auto-update Stable Channel",
        body: `This release contains the update information for ${prerelease ? "alpha" : "stable"} channel.`,
        prerelease
      });
      return data;
    }
    throw error;
  }
}

async function uploadJsonAsset(octokit, options, releaseId, name, json) {
  await octokit.repos.uploadReleaseAsset({
    ...options,
    release_id: releaseId,
    name,
    data: Buffer.from(JSON.stringify(json, null, 2), "utf8"),
    headers: {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(JSON.stringify(json, null, 2)).toString()
    }
  });
}

async function getSignature(url) {
  const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/octet-stream" } });
  return res.text();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

