/**
 * Representa la estructura de un archivo o directorio en el explorador de archivos.
 */
export interface FileData {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileData[];
}

/**
 * Representa un feature dentro de un módulo en la lista de ejecución.
 */
export interface FeatureItem {
  id: string; // ID único para dnd-kit, puede ser una combinación de module+feature
  feature_file: string;
  feature_dir: string;
  order: number;
  active: boolean;
  color?: string;
  tags: string[] | null; // Tags seleccionados para la ejecución (se guarda en JSON)
  display_tags?: string[]; // Todos los tags del .feature (solo para mostrar)
  scenarios?: string[]; // Nombres de los escenarios del .feature
}

/**
 * Representa un módulo en la lista de ejecución, que contiene una lista de features.
 */
export interface Module {
  module_name: string;
  order: number;
  active: boolean;
  features: FeatureItem[];
  color?: string;
  is_collapsed?: boolean; // Estado de colapso para la UI
  setup?: (Module | string)[];
  teardown?: (Module | string)[];
  view_states?: {
    execution_order?: { [key: string]: boolean };
    modules_view?: { [key: string]: boolean };
  };
}

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