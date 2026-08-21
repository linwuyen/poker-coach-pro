import { PostflopTruthNode } from './types';
import { validatePostflopTruthNode } from './importer';

export const POSTFLOP_TRUTH_STORAGE_KEY = 'poker_postflop_truth_nodes_v3';

export function loadPostflopTruthNodes(): PostflopTruthNode[] {
  try {
    const raw = JSON.parse(localStorage.getItem(POSTFLOP_TRUTH_STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const result: PostflopTruthNode[] = [];
    for (const candidate of raw) {
      try { result.push(validatePostflopTruthNode(candidate)); } catch { /* invalid local data stays unavailable */ }
    }
    return result;
  } catch { return []; }
}

export function savePostflopTruthNodes(nodes: PostflopTruthNode[]): void {
  localStorage.setItem(POSTFLOP_TRUTH_STORAGE_KEY, JSON.stringify(nodes.map(validatePostflopTruthNode)));
}
