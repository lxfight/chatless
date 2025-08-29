"use client";
import React from "react";
import HttpRequestDebugger from "@/components/devtools/HttpRequestDebugger";

export default function Page() {
  return (
    <div className="min-h-screen">
      <HttpRequestDebugger />
    </div>
  );
}


