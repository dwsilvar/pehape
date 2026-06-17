import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, useTheme, Tooltip, IconButton } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import LibraryBooksRoundedIcon from '@mui/icons-material/LibraryBooksRounded';
import {
  DndContext, DragEndEvent, closestCorners, useSensor, useSensors, PointerSensor, TouchSensor,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { v4 as uuidv4 } from 'uuid';

import { FeatureWithScenarios, BlueprintsData, BlueprintRef, PlanTask } from '../types';
import PlanHeader from '../components/test-plan/PlanHeader';
import BlueprintCatalogPanel from '../components/test-plan/BlueprintCatalogPanel';
import CompositionCanvas from '../components/test-plan/CompositionCanvas';
import CompositionAssetLibraryPanel from '../components/test-plan/CompositionAssetLibraryPanel';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';

const LEFT_WIDTH_DEFAULT = 260;
const RIGHT_WIDTH_DEFAULT = 320;
const MIN_PANEL_WIDTH = 180;

const TestPlanPage: React.FC = () => {
  const { t } = useTranslation();
  
  // ── State ─────────────────────────────────────────────────────────────
  const [blueprints, setBlueprints] = useState<BlueprintsData>({ plans: [], cycles: [], sets: [], flows: [] });
  const [activeCategory, setActiveCategory] = useState<'plans' | 'cycles' | 'sets' | 'flows'>('flows');
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null);

  const [features, setFeatures] = useState<FeatureWithScenarios[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [isBlueprintsLoading, setIsBlueprintsLoading] = useState(true);

  const [isSaved, setIsSaved] = useState(true);

  // ── Layout State ────────────────────────────────────────────────────────────
  const [leftWidth, setLeftWidth] = useState(LEFT_WIDTH_DEFAULT);
  const [rightWidth, setRightWidth] = useState(RIGHT_WIDTH_DEFAULT);
  const [libraryVisible, setLibraryVisible] = useState(true);
  const theme = useTheme();
  const layoutRef = useRef<HTMLDivElement>(null);

  const fetchBlueprints = useCallback(() => {
    setIsBlueprintsLoading(true);
    fetch('/api/blueprints')
      .then(r => r.ok ? r.json() : { plans: [], cycles: [], sets: [], flows: [] })
      .then(data => {
        setBlueprints(data);
        if (data[activeCategory] && data[activeCategory].length > 0) {
          // Keep current selection if valid, otherwise select first
          if (!selectedBlueprintId || !data[activeCategory].find((b: any) => b.id === selectedBlueprintId)) {
            setSelectedBlueprintId(data[activeCategory][0].id);
          }
        }
      })
      .catch(() => setBlueprints({ plans: [], cycles: [], sets: [], flows: [] }))
      .finally(() => setIsBlueprintsLoading(false));
  }, [activeCategory, selectedBlueprintId]);

  // ── Initial Load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchBlueprints();

    setIsLibraryLoading(true);
    fetch('/api/features-with-scenarios')
      .then(r => r.ok ? r.json() : [])
      .then(data => setFeatures(Array.isArray(data) ? data : []))
      .catch(() => setFeatures([]))
      .finally(() => setIsLibraryLoading(false));
  }, []);

  // ── Persistence ───────────────────────────────────────────────────────────────
  const markDirty = useCallback(() => {
    setIsSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      await fetch('/api/blueprints', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blueprints),
      });
      setIsSaved(true);
    } catch (e) {
      console.error('Failed to save blueprints', e);
    }
  }, [blueprints]);

  // ── Unsaved Changes Guard ──────────────────────────────────────────────
  const blocker = useUnsavedChangesGuard(!isSaved, '/');

  const handleSaveAndLeave = useCallback(async () => {
    await handleSave();
    blocker.proceed?.();
  }, [handleSave, blocker]);

  const handleDiscardAndLeave = useCallback(() => {
    blocker.proceed?.();
  }, [blocker]);

  const handleCancelLeave = useCallback(() => {
    blocker.reset?.();
  }, [blocker]);

  const handleImport = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/import-plan', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        fetchBlueprints();
        alert("Plan importado exitosamente");
      } else {
        const error = await response.json();
        alert(`Error al importar: ${error.detail}`);
      }
    } catch (error) {
      alert(`Error al importar: ${error}`);
    }
  }, [fetchBlueprints]);

  // ── Active Blueprint Helpers ─────────────────────────────────────────────────
  const getActiveBlueprintList = useCallback(() => {
    switch (activeCategory) {
      case 'plans': return blueprints.plans;
      case 'cycles': return blueprints.cycles;
      case 'sets': return blueprints.sets;
      case 'flows': return blueprints.flows;
      default: return [];
    }
  }, [activeCategory, blueprints]);

  const activeBlueprint = getActiveBlueprintList().find(b => b.id === selectedBlueprintId) || null;

  const updateActiveBlueprint = useCallback((updater: (prev: any) => any) => {
    if (!selectedBlueprintId) return;
    setBlueprints(prev => {
      const next = { ...prev };
      next[activeCategory] = (next[activeCategory] as any[]).map(b =>
        b.id === selectedBlueprintId ? updater(b) : b
      );
      return next as BlueprintsData;
    });
    markDirty();
  }, [activeCategory, selectedBlueprintId, markDirty]);

  // ── Catalog Actions ──────────────────────────────────────────────────────────
  const handleAddBlueprint = (cat: 'plans' | 'cycles' | 'sets' | 'flows', name: string) => {
    const newBp = { id: uuidv4(), name, items: [] };
    setBlueprints(prev => ({ ...prev, [cat]: [...prev[cat], newBp] }));
    setActiveCategory(cat);
    setSelectedBlueprintId(newBp.id);
    markDirty();
  };

  const handleDeleteBlueprint = (cat: 'plans' | 'cycles' | 'sets' | 'flows', id: string) => {
    setBlueprints(prev => {
      // 1. Remove the entity itself
      const updatedList = prev[cat].filter(b => b.id !== id);
      const newPrev = { ...prev, [cat]: updatedList };
      
      // 2. Cascade delete: remove references to this ID from all other blueprints
      const cleanItems = (items: any[]) => items.filter(item => item.refId !== id);
      
      (['plans', 'cycles', 'sets', 'flows'] as const).forEach((c) => {
        newPrev[c] = newPrev[c].map((bp: any) => ({
          ...bp,
          items: cleanItems(bp.items || [])
        }));
      });

      if (activeCategory === cat && selectedBlueprintId === id) {
        setSelectedBlueprintId(updatedList.length > 0 ? updatedList[0].id : null);
      }
      return newPrev;
    });
    markDirty();
  };

  const handleSelectBlueprint = (id: string | null) => {
    setSelectedBlueprintId(id);
  };

  const handleNavigateToBlueprint = (type: string, id: string) => {
    let targetCategory: 'plans' | 'cycles' | 'sets' | 'flows' | null = null;
    if (type === 'cycle') targetCategory = 'cycles';
    else if (type === 'set') targetCategory = 'sets';
    else if (type === 'flow') targetCategory = 'flows';
    else if (type === 'plan') targetCategory = 'plans';
    
    if (targetCategory) {
      setActiveCategory(targetCategory);
      setSelectedBlueprintId(id);
    }
  };

  const handleCategoryChange = (cat: 'plans' | 'cycles' | 'sets' | 'flows') => {
    setActiveCategory(cat);
    const categoryBlueprints = blueprints[cat] || [];
    if (categoryBlueprints.length > 0) {
      setSelectedBlueprintId(categoryBlueprints[0].id);
    } else {
      setSelectedBlueprintId(null);
    }
  };

  // ── Canvas Actions ───────────────────────────────────────────────────────────
  const handleNameChange = (newName: string) => {
    updateActiveBlueprint(b => ({ ...b, name: newName }));
  };

  const handleRemoveItem = (id: string) => {
    updateActiveBlueprint(b => ({ ...b, items: b.items.filter((i: BlueprintRef) => i.id !== id) }));
  };

  const handleMoveUp = (id: string) => {
    updateActiveBlueprint(b => {
      const idx = b.items.findIndex((i: BlueprintRef) => i.id === id);
      if (idx <= 0) return b;
      return { ...b, items: arrayMove(b.items, idx, idx - 1) };
    });
  };

  const handleMoveDown = (id: string) => {
    updateActiveBlueprint(b => {
      const idx = b.items.findIndex((i: BlueprintRef) => i.id === id);
      if (idx === -1 || idx >= b.items.length - 1) return b;
      return { ...b, items: arrayMove(b.items, idx, idx + 1) };
    });
  };

  const handleUpdateItemTasks = useCallback((itemId: string, tasks: PlanTask[]) => {
    updateActiveBlueprint(b => ({
      ...b,
      items: b.items.map((i: BlueprintRef) => i.id === itemId ? { ...i, tasks } : i)
    }));
  }, [updateActiveBlueprint]);

  const handleUpdateBlueprintTasks = useCallback((tasks: PlanTask[]) => {
    updateActiveBlueprint(b => ({ ...b, tasks }));
  }, [updateActiveBlueprint]);

  // ── DnD ───────────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !selectedBlueprintId) return;

    if (active.data.current?.type === 'library-item' || active.data.current?.type === 'library-scenario') {
      let newItem: BlueprintRef;

      if (active.data.current.type === 'library-scenario') {
        const { featurePath, featureName, featureTitle, scenario } = active.data.current;
        newItem = {
          id: uuidv4(),
          refId: '',
          type: 'scenario',
          featurePath,
          name: featureTitle || featureName,
          scenarioName: scenario.name,
          tags: scenario.tags,
          steps: scenario.steps,
        };
      } else {
        newItem = { ...active.data.current.item, id: uuidv4() };
      }

      updateActiveBlueprint(b => {
        const prevItems = b.items;
        if (over.data.current?.type === 'composition-item') {
          const overIdx = prevItems.findIndex((i: BlueprintRef) => i.id === over.id);
          const next = [...prevItems];
          next.splice(overIdx >= 0 ? overIdx : next.length, 0, newItem);
          return { ...b, items: next };
        }
        return { ...b, items: [...prevItems, newItem] };
      });
      return;
    }

    if (active.data.current?.type === 'composition-item' && over.data.current?.type === 'composition-item' && active.id !== over.id) {
      updateActiveBlueprint(b => {
        const prevItems = b.items;
        const oldIdx = prevItems.findIndex((i: BlueprintRef) => i.id === active.id);
        const newIdx = prevItems.findIndex((i: BlueprintRef) => i.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return b;
        return { ...b, items: arrayMove(prevItems, oldIdx, newIdx) };
      });
    }
  }, [selectedBlueprintId, updateActiveBlueprint]);

  const makeResizeHandler = useCallback((side: 'left' | 'right') => {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = side === 'left' ? leftWidth : rightWidth;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const newW = Math.max(MIN_PANEL_WIDTH, startWidth + (side === 'left' ? delta : -delta));
        if (side === 'left') setLeftWidth(newW);
        else setRightWidth(newW);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
  }, [leftWidth, rightWidth]);

  const targetPlan = blueprints.plans?.[0];

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <Box ref={layoutRef} sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', bgcolor: theme.palette.custom.bgMain }}>
        <PlanHeader
          plan={null} cycle={null} flow={null} 
          activeBlueprintName={activeBlueprint?.name}
          targetPlanName={targetPlan?.name}
          targetPlanId={targetPlan?.id}
          isSaved={isSaved}
          onSave={handleSave}
          onImport={handleImport}
        />

        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Left: Blueprint Catalog */}
          <Box sx={{ width: leftWidth, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <BlueprintCatalogPanel
              blueprints={blueprints}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              selectedBlueprintId={selectedBlueprintId}
              onSelectBlueprint={handleSelectBlueprint}
              onAddBlueprint={handleAddBlueprint}
              onDeleteBlueprint={handleDeleteBlueprint}
              onNavigateToBlueprint={handleNavigateToBlueprint}
            />
          </Box>

          <Box onMouseDown={makeResizeHandler('left')} sx={{ width: 4, cursor: 'col-resize', bgcolor: theme.palette.custom.border, flexShrink: 0, '&:hover': { bgcolor: 'primary.main' } }} />

          {/* Center: Canvas */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <CompositionCanvas
              category={activeCategory}
              blueprintId={selectedBlueprintId}
              name={activeBlueprint?.name || ''}
              items={activeBlueprint?.items || []}
              onNameChange={handleNameChange}
              onRemoveItem={handleRemoveItem}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              blueprints={blueprints}
              onUpdateItemTasks={handleUpdateItemTasks}
              tasks={activeBlueprint?.tasks || []}
              onUpdateTasks={handleUpdateBlueprintTasks}
            />
          </Box>

          <Box
            sx={{ width: libraryVisible ? 4 : 28, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', bgcolor: theme.palette.custom.border, cursor: libraryVisible ? 'col-resize' : 'default', '&:hover': { bgcolor: libraryVisible ? 'primary.main' : theme.palette.custom.border } }}
            onMouseDown={libraryVisible ? makeResizeHandler('right') : undefined}
          >
            <Tooltip title={libraryVisible ? 'Ocultar biblioteca' : 'Mostrar biblioteca'} placement="left">
              <IconButton size="small" onClick={() => setLibraryVisible(v => !v)} onMouseDown={e => e.stopPropagation()} sx={{ position: libraryVisible ? 'absolute' : 'static', right: libraryVisible ? -12 : 'auto', width: 24, height: 24, bgcolor: theme.palette.background.paper, border: `1px solid ${theme.palette.custom.border}`, borderRadius: '50%', opacity: libraryVisible ? 0 : 1, zIndex: 10, '&:hover': { bgcolor: theme.palette.primary.main, color: 'white', opacity: 1 }, '.MuiBox-root:hover &': { opacity: 1 }, p: 0.25 }}>
                {libraryVisible ? <ChevronRightRoundedIcon sx={{ fontSize: 14 }} /> : <ChevronLeftRoundedIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
            {!libraryVisible && <Tooltip title="Biblioteca" placement="left"><LibraryBooksRoundedIcon sx={{ fontSize: 13, color: 'text.disabled', mt: 1 }} /></Tooltip>}
          </Box>

          {/* Right: Asset Library */}
          <Box sx={{ width: libraryVisible ? rightWidth : 0, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <CompositionAssetLibraryPanel
              features={features}
              blueprints={blueprints}
              isLoading={isLibraryLoading || isBlueprintsLoading}
              activeCategory={activeCategory}
            />
          </Box>
        </Box>
      </Box>

      {/* Unsaved Changes Confirmation Dialog */}
      <UnsavedChangesDialog
        open={blocker.state === 'blocked'}
        onSaveAndLeave={handleSaveAndLeave}
        onDiscardAndLeave={handleDiscardAndLeave}
        onCancel={handleCancelLeave}
      />
    </DndContext>
  );
};

export default TestPlanPage;
