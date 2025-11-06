export interface FileData {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileData[];
}

export interface ExecutionItem {
  id: string;
  text: string;
  order: number;
  active: boolean;
  type: 'module' | 'feature';
  moduleId?: string;  // For features, references parent module
}