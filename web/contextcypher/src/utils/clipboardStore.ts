// Clipboard storage utility
// This file is excluded from obfuscation to prevent issues with global state

import { SecurityNode, SecurityEdge } from '../types/SecurityTypes';

// Store clipboard data in a module-level variable instead of window
let clipboardNodes: SecurityNode[] | null = null;
let clipboardEdges: SecurityEdge[] | null = null;

export const clipboardStore = {
  setNodes(nodes: SecurityNode[]): void {
    clipboardNodes = nodes ? JSON.parse(JSON.stringify(nodes)) : null;
  },

  setEdges(edges: SecurityEdge[]): void {
    clipboardEdges = edges ? JSON.parse(JSON.stringify(edges)) : null;
  },

  setData(nodes: SecurityNode[], edges: SecurityEdge[]): void {
    clipboardNodes = nodes ? JSON.parse(JSON.stringify(nodes)) : null;
    clipboardEdges = edges ? JSON.parse(JSON.stringify(edges)) : null;
  },

  getNodes(): SecurityNode[] | null {
    return clipboardNodes;
  },

  getEdges(): SecurityEdge[] | null {
    return clipboardEdges;
  },

  hasData(): boolean {
    return clipboardNodes !== null && clipboardNodes.length > 0;
  },

  clear(): void {
    clipboardNodes = null;
    clipboardEdges = null;
  }
};