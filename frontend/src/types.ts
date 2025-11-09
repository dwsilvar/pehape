export interface FileData {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileData[];
}

export interface FeatureItem {
  id: string;
  feature_file: string;
  order: number;
  active: boolean;
  feature_dir?: string;
  color?: string;
}

export interface Module {
  module_name: string;
  active: boolean;
  module_dir: string;
  order: number;
  features: FeatureItem[];
  color?: string;
}