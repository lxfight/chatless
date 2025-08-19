"use client";
import React from "react";
import { specializedStorage } from "@/lib/storage";

export function useRecentModelsHint(providerName: string) {
  const [lastUsedMap, setLastUsedMap] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    (async () => {
      try {
        await specializedStorage.models.getRecentModels();
        const pair = await specializedStorage.models.getLastSelectedModelPair();
        const map: Record<string, string> = {};
        if (pair && pair.provider === providerName) {
          map[pair.modelId] = '刚用过';
        }
        setLastUsedMap(map);
      } catch {}
    })();
  }, [providerName]);

  return lastUsedMap;
}

