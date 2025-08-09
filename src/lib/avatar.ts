/**
 * 生成一个基于 seed 的简约头像（SVG data URL）。
 * - 稳定：同一 seed 始终生成相同的颜色与形状参数
 * - 轻量：不引入第三方库
 * - 适配：在浅色/深色下都有足够对比度
 */
export function generateAvatarDataUrl(seed: string, label?: string, size: number = 40): string {
  const s = String(seed || 'seed');
  // 简单 hash（djb2）
  let hash = 5381;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash) + s.charCodeAt(i);

  // 由 hash 派生两组颜色（HSL → HEX）
  const h1 = Math.abs(hash) % 360;
  const h2 = (Math.abs(hash >> 3) % 360 + 30) % 360;
  const bg = hslToHex(h1, 60, 80); // 柔和浅背景
  const fg = hslToHex(h2, 65, 40); // 稍深前景

  // 圆角与形状参数
  const r = 8 + (Math.abs(hash >> 6) % 12); // 8~20 的圆角
  const pad = 2;
  const w = size;
  const h = size;
  const text = (label || s).trim().charAt(0).toUpperCase() || 'A';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${lightenHex(bg, 8)}"/>
    </linearGradient>
  </defs>
  <rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${h - pad * 2}" rx="${r}" ry="${r}" fill="url(#g)"/>
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system,system-ui,Segoe UI,Roboto,Helvetica,Arial" font-size="${Math.floor(size * 0.42)}" font-weight="700" fill="${fg}">${escapeXml(text)}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function hslToHex(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function lightenHex(hex: string, amount: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amount * 2);
  const g = Math.min(255, ((n >> 8) & 0xff) + amount * 2);
  const b = Math.min(255, (n & 0xff) + amount * 2);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function escapeXml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
}


