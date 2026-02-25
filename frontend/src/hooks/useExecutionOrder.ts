import { useState, useEffect, useCallback } from 'react';
import { Module } from '../types';
import type React from 'react';

const processModules = (modules: Module[]): Module[] => {
  const moduleMap = modules.reduce((acc, module) => {
    acc[module.module_name] = module;
    return acc;
  }, {} as { [key: string]: Module });

  return modules.map(module => ({
    ...module,
    setup: ((module.setup as any[]) || []).map(hook =>
      typeof hook === 'string' ? moduleMap[hook] : hook
    ).filter(Boolean),
    teardown: ((module.teardown as any[]) || []).map(hook =>
      typeof hook === 'string' ? moduleMap[hook] : hook
    ).filter(Boolean),
  }));
};


export const useExecutionOrder = () => {
  const [modules, setModulesState] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAndProcessModules = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/execution-order?include_inactive=true');
      if (!response.ok) {
        throw new Error('Failed to fetch execution order');
      }
      const data: Module[] = await response.json();
      setModules(data);
    } catch (error) {
      console.error("Error fetching execution order:", error);
      setModules([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndProcessModules();
  }, [fetchAndProcessModules]);

  const setModules = (action: React.SetStateAction<Module[]>) => {
    if (typeof action === 'function') {
      // functional updater
      setModulesState((prev) => {
        const compute = action as (prev: Module[]) => Module[];
        const next = compute(prev);
        return processModules(next);
      });
    } else {
      // direct array replacement
      setModulesState(processModules(action));
    }
  };

  return { modules, isLoading, setModules, refetch: fetchAndProcessModules };
};
