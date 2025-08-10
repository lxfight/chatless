"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

// 统一裁剪描述文本，避免右下角弹窗过长
export function trimToastDescription(input: unknown, maxLen: number = 180): string | undefined {
  if (input == null) return undefined;
  let raw: string;
  if (typeof input === 'string') raw = input;
  else if ((input as any)?.message) raw = String((input as any).message);
  else {
    try { raw = JSON.stringify(input); } catch { raw = String(input); }
  }
  raw = raw.replace(/\s+/g, ' ').trim();
  if (raw.length > maxLen) return raw.slice(0, maxLen) + '…';
  return raw;
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
