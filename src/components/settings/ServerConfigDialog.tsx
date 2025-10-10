"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getServerConfig, setServerConfig, type ServerConfig } from "@/lib/mcp/authorizationConfig";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName: string;
  globalDefaults: {
    autoAuthorize: boolean;
    maxRecursionDepth: number;
  };
}

export default function ServerConfigDialog({ open, onOpenChange, serverName, globalDefaults }: Props) {
  const [autoAuthMode, setAutoAuthMode] = useState<'default' | 'enabled' | 'disabled'>('default');
  const [maxDepthMode, setMaxDepthMode] = useState<'default' | 'custom'>('default');
  const [customMaxDepth, setCustomMaxDepth] = useState(6);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 加载服务器配置
  useEffect(() => {
    if (open && serverName) {
      setLoading(true);
      getServerConfig(serverName)
        .then(config => {
          // 授权模式
          if (config.autoAuthorize === undefined) {
            setAutoAuthMode('default');
          } else if (config.autoAuthorize) {
            setAutoAuthMode('enabled');
          } else {
            setAutoAuthMode('disabled');
          }
          
          // 递归深度模式
          if (config.maxRecursionDepth === undefined) {
            setMaxDepthMode('default');
            setCustomMaxDepth(globalDefaults.maxRecursionDepth);
          } else {
            setMaxDepthMode('custom');
            setCustomMaxDepth(config.maxRecursionDepth);
          }
        })
        .catch(err => {
          console.error('[SERVER-CONFIG] 加载配置失败:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, serverName, globalDefaults]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const config: ServerConfig = {};
      
      // 授权设置
      if (autoAuthMode === 'enabled') {
        config.autoAuthorize = true;
      } else if (autoAuthMode === 'disabled') {
        config.autoAuthorize = false;
      }
      // default模式不设置，使用undefined
      
      // 递归深度设置
      if (maxDepthMode === 'custom') {
        config.maxRecursionDepth = customMaxDepth;
      }
      // default模式不设置，使用undefined
      
      await setServerConfig(serverName, config);
      onOpenChange(false);
    } catch (err) {
      console.error('[SERVER-CONFIG] 保存配置失败:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>服务器配置 - {serverName}</DialogTitle>
          <DialogDescription>
            配置此服务器的特定行为。这些设置优先级高于全局默认设置。
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-slate-500">加载中...</div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* 授权设置 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">工具调用授权</Label>
              <Select value={autoAuthMode} onValueChange={(v: any) => setAutoAuthMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    使用默认设置 ({globalDefaults.autoAuthorize ? '自动授权' : '手动确认'})
                  </SelectItem>
                  <SelectItem value="enabled">自动授权（跳过确认）</SelectItem>
                  <SelectItem value="disabled">手动确认（需要批准）</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                控制此服务器的工具调用是否需要手动确认
              </span>
            </div>

            {/* 最大递归深度 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">最大递归深度</Label>
              <Select value={maxDepthMode} onValueChange={(v: any) => setMaxDepthMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    使用默认设置 ({globalDefaults.maxRecursionDepth})
                  </SelectItem>
                  <SelectItem value="custom">自定义深度</SelectItem>
                </SelectContent>
              </Select>
              
              {maxDepthMode === 'custom' && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">当前值：{customMaxDepth}</span>
                  </div>
                  <Slider
                    min={2}
                    max={20}
                    step={1}
                    value={[customMaxDepth]}
                    onValueChange={([v]) => setCustomMaxDepth(v)}
                  />
                </>
              )}
              
              <span className="text-xs text-slate-500 dark:text-slate-400">
                此服务器工具可以递归调用的最大次数
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            size="sm"
            className="bg-blue-500 hover:bg-blue-600 text-white"
            disabled={saving || loading}
            onClick={handleSave}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

