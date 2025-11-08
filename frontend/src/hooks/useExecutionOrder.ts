import React, { useCallback } from 'react';
import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

interface FeatureItem {
  id: string;
  [key: string]: any;
}

interface Module {
  module_name: string;
  features: FeatureItem[];
  [key: string]: any;
}

export const useExecutionOrder = () => {
  const [modules, setModules] = React.useState<Module[]>([]);

  React.useEffect(() => {
    fetch('/api/execution-order')
      .then(res => res.json())
      .then(data => setModules(data))
      .catch(console.error);
  }, []);

  const handleSave = useCallback(() => {
    fetch('/api/execution-order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modules),
    }).catch(console.error);
  }, [modules]);
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setModules((currentModules) => {
        const activeId = active.id as string;
        const overId = over.id as string;

        let activeModuleIndex = -1;
        let activeFeatureIndex = -1;
        let overModuleIndex = -1;
        let overFeatureIndex = -1;

        // Find indices for the active and target items
        currentModules.forEach((module: Module, mIndex: number) => {
          module.features.forEach((feature: FeatureItem, fIndex: number) => {
            if (feature.id === activeId) {
              activeModuleIndex = mIndex;
              activeFeatureIndex = fIndex;
            }
            if (feature.id === overId) {
              overModuleIndex = mIndex;
              overFeatureIndex = fIndex;
            }
          });
        });

        // If moving within the same module
        if (activeModuleIndex === overModuleIndex && activeModuleIndex !== -1) {
          const newModules = [...currentModules];
          const targetModule = newModules[activeModuleIndex];
          if (targetModule && targetModule.features) {
            targetModule.features = arrayMove(targetModule.features, activeFeatureIndex, overFeatureIndex);
            // Re-assign order for features within the affected module
            targetModule.features.forEach((feature, index) => {
              feature.order = index + 1;
            });
          }
          return newModules;
        }
        // Do nothing if moving between modules for now
        return currentModules;
      });
    }
  };

  return { modules, setModules, handleSave, handleDragEnd };
};