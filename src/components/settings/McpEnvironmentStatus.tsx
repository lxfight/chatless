"use client";
import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, ExternalLink } from "lucide-react";
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            MCP Environment Status
          </CardTitle>
          <CardDescription>Checking required tools...</CardDescription>
        </CardHeader>
      </Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {health.overall_healthy ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            )}
            MCP Environment Status
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadHealthStatus}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
        <CardDescription>
          {health.overall_healthy
            ? "All required tools are available"
            : "Some required tools are missing"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 整体状态 */}
        <div className={`p-3 rounded-lg border ${
          health.overall_healthy
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-yellow-50 border-yellow-200 text-yellow-800"
        }`}>
          <div className="font-medium">
            {health.overall_healthy ? (
              "✓ MCP services can run normally"
            ) : (
              "⚠ MCP services cannot run due to missing tools"
            )}
          </div>
        </div>

        {/* 工具状态 */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Required Tools:</h4>
          <div className="space-y-2">
            {health.tools.map((tool) => (
              <div
                key={tool.tool_name}
                className="flex items-center justify-between p-2 rounded border"
              >
                <div className="flex items-center gap-2">
                  {tool.available ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-mono text-sm">{tool.tool_name}</span>
                  <Badge variant={tool.available ? "default" : "destructive"}>
                    {tool.available ? "Available" : "Missing"}
                  </Badge>
                </div>
                {tool.path && (
                  <span className="text-xs text-gray-500 truncate max-w-48">
                    {tool.path}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 安装建议 */}
        {health.recommendations.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Installation Required</AlertTitle>
            <AlertDescription>
              <div className="space-y-2">
                <p>The following tools are required for MCP services:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {health.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openNodeJsWebsite}
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Download Node.js
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
