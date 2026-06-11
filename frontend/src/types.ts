/**
 * Representa la estructura de un archivo o directorio en el explorador de archivos.
 */
export interface FileData {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileData[];
}




// ── Test Plan Designer Types ──────────────────────────────────────────────────

/**
 * A single Gherkin scenario referenced inside a TestCycle.
 */
export interface ScenarioRef {
  id: string;           // unique instance id (cloned per-drop)
  featurePath: string;  // e.g. "retiro/retiro.feature"
  featureName: string;  // Feature title from the .feature file
  scenarioName: string;
  tags: string[];
  steps: string[];      // First N step lines for preview
}

/**
 * A sequence of scenarios grouped together in a TestCycle.
 */
export interface TestFlow {
  id: string;
  name: string;
  scenarios: ScenarioRef[];
}

/**
 * An ordered list of test flows that make up a test run slice.
 */
export interface TestCycle {
  id: string;
  name: string;
  flows: TestFlow[];
  // Backward compatibility: Some old cycles might have these properties
  flowName?: string;
  scenarios?: ScenarioRef[];
}

/**
 * Top-level container grouping one or more TestCycles.
 */
export interface TestPlan {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'completed';
  cycles: TestCycle[];
}

/**
 * Scenario metadata returned by /api/features-with-scenarios.
 */
export interface ScenarioMeta {
  name: string;
  tags: string[];
  steps: string[];
}

/**
 * Feature file with parsed scenario metadata.
 */
export interface FeatureWithScenarios {
  name: string;         // filename e.g. "retiro.feature"
  path: string;         // relative path e.g. "retiro/retiro.feature"
  featureTitle: string; // Feature: ... title
  scenarios: ScenarioMeta[];
}

// ── Blueprint Designer Types ──────────────────────────────────────────────────

export interface PlanTask {
  id: string;        // Unique configuration UUID
  name: string;      // Task name (e.g. "limpiar_log")
  hook: 'before' | 'after';
  scope: 'scenario' | 'step';
  args: Record<string, any>;
  targetScenario?: string;
}

export interface BlueprintRef {
  id: string; // instance id within the canvas
  refId: string; // the ID of the referenced blueprint or feature path
  type: 'scenario' | 'feature' | 'flow' | 'set' | 'cycle';
  name: string; // display name
  // For scenarios
  featurePath?: string;
  scenarioName?: string;
  tags?: string[];
  steps?: string[];
  tasks?: PlanTask[]; // Tasks associated directly to this instance
}

export interface FlowBlueprint {
  id: string;
  name: string;
  items: BlueprintRef[]; // Should be only 'scenario'
  tasks?: PlanTask[];
}

export interface SetBlueprint {
  id: string;
  name: string;
  items: BlueprintRef[]; // Can be 'flow' or 'feature'
  tasks?: PlanTask[];
}

export interface CycleBlueprint {
  id: string;
  name: string;
  items: BlueprintRef[]; // Can be 'flow' or 'set'
  tasks?: PlanTask[];
}

export interface PlanBlueprint {
  id: string;
  name: string;
  items: BlueprintRef[]; // Can be 'cycle'
  tasks?: PlanTask[];
}

export interface BlueprintsData {
  plans: PlanBlueprint[];
  cycles: CycleBlueprint[];
  sets: SetBlueprint[];
  flows: FlowBlueprint[];
}

// ── Execution Status Types ─────────────────────────────────────────────────────

/**
 * Define los posibles estados de un escenario durante la ejecución.
 */
export type ScenarioStatus = 'passed' | 'failed' | 'skipped' | 'untested' | 'running';

/**
 * Mapea nombres de escenarios a su estado de ejecución.
 * Ejemplo: { "Mi primer escenario": "passed" }
 */
export interface ScenarioStatusMap {
  [scenarioName: string]: ScenarioStatus;
}