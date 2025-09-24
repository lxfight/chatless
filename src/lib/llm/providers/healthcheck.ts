export function judgeApiReachable(status: number, bodyText: string | null | undefined) {
  const text = String(bodyText || '').trim();
  const lower = text.toLowerCase();

  // 只要服务器有响应（非网络/超时），一般即可认为“API 可达”。
  // 但仍然给出更细的提示信息，方便用户判断。
  let ok = false;
  let message: string | undefined;

  // 常见可达状态（含客户端/服务端错误、限流等）
  if (status >= 200 && status < 600) {
    ok = true;
  }

  // 关键字/结构：即便返回 200，只要 body 中包含鉴权/密钥错误等提示，也认为 API 可达
  const keywordReachable = /auth|unauthor|forbid|token|api\s*key|apikey|secret|credential|signature|permission|expired|invalid|missing|key\s*id|bearer|access\s*key|not\s*allowed/i.test(lower);

  // 常见错误 JSON 结构
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
  const hasErrorShape = !!(
    parsed && (
      parsed.error || parsed.errors || parsed.error_code || parsed.errorCode ||
      parsed.code !== undefined || parsed.status === 'error' || parsed.ok === false
    )
  );

  if (!ok && (keywordReachable || hasErrorShape)) {
    ok = true;
  }

  // 生成友好信息（统一对外文案，避免误导用户）
  if (ok) {
    message = 'API 基本可用，密钥请使用时再确认';
  }

  return { ok, message, status, parsed } as { ok: boolean; message?: string; status: number; parsed?: any };
}


