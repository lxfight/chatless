"use client";
import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, CheckCircle, XCircle, ExternalLink, RefreshCw } from "lucide-react";
import FoldingLoader from "@/components/ui/FoldingLoader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ToolAvailability {
  tool_name: string;
  available: boolean;
  path?: string;
  error_message?: string;
}

interface EnvironmentHealth {
  overall_healthy: boolean;
  tools: ToolAvailability[];
  missing_critical_tools: string[];
  recommendations: string[];
}

export function McpEnvironmentStatus() {
  const [health, setHealth] = useState<EnvironmentHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHealthStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<EnvironmentHealth>("get_environment_health");
      setHealth(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load environment status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealthStatus();
  }, []);

  const openNodeJsWebsite = () => {
    window.open("https://nodejs.org/", "_blank");
  };

  if (loading) {
    return (
      <Alert variant="default" className="flex items-center gap-2">
        <FoldingLoader size={16} />
        <span>正在检测 MCP 依赖…</span>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!health) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load environment status</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant={health.overall_healthy ? "success" : "default"} className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {health.overall_healthy ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
        )}
        <span>
          {health.overall_healthy
            ? "所有 MCP 依赖已就绪，服务可正常运行"
            : `缺少工具：${health.missing_critical_tools.join(", ")}`}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={loadHealthStatus}
        title="重新检测"
      >
        <RefreshCw size={16} />
      </Button>
    </Alert>
  );
}
