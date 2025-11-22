export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

export interface IconFile {
  path: string;
  filename: string;
  category: string;
  size: number;
  rawUrl: string;
  isLegacy: boolean;
  extension: string;
  productName: string;
}

export interface CategoryCount {
  name: string;
  count: number;
}

export interface CachedData {
  timestamp: number;
  icons: IconFile[];
}
