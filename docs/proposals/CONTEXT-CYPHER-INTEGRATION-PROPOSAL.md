# Context Cypher Integration into GuardianAgent — Hybrid React Micro-App

## Context

Context Cypher is a React-based security diagram / threat modeling application with 200+ node types, rich edge metadata, and cloud vendor iconography. The goal is to port its **core diagram engine** (nodes, edges, diagram CRUD) into GuardianAgent as a new **Architecture** panel and tool category — enabling the LLM agent to programmatically create, edit, and analyze security topology diagrams.

**Scope:** Core diagram functionality only. AI integration, GRC module, and license system are excluded.

**Key constraint:** GuardianAgent's web UI is vanilla JavaScript (no React, no build step). Rather than rewrite the entire frontend or use an inferior vanilla JS diagram library, we use a **hybrid approach**: build a self-contained React micro-app (using Vite) that bundles ReactFlow + the ported Context Cypher components into a single JS file. This bundle is loaded only on the Architecture page. All other pages remain vanilla JS, untouched.

**Cloud resource discovery** is agent-orchestrated: the LLM calls existing cloud tools to discover resources, then calls diagram tools to build diagrams. No dedicated `diagram_from_cloud` tool.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  GuardianAgent Web UI (vanilla JS)                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────────┐ │
│  │ Dashboard │ │ Security │ │ Cloud    │ │ Architecture           │ │
│  │ (vanilla) │ │ (vanilla)│ │ (vanilla)│ │ ┌──────────────────┐  │ │
│  │           │ │          │ │          │ │ │ React Micro-App  │  │ │
│  │           │ │          │ │          │ │ │ (ReactFlow +     │  │ │
│  │           │ │          │ │          │ │ │  ported Context  │  │ │
│  │           │ │          │ │          │ │ │  Cypher comps)   │  │ │
│  │           │ │          │ │          │ │ └──────────────────┘  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────────┘ │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ REST API /api/architecture/*
┌──────────────────────────┴─────────────────────────────────────────┐
│  Backend (TypeScript, no change to build)                           │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐    │
│  │ DiagramStore          │  │ DiagramAnalyzer                  │    │
│  │ (JSON file CRUD)      │  │ (topology/gaps/zone violations)  │    │
│  └──────────────────────┘  └──────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 7 Diagram Tools (ToolCategory: 'diagram')                   │   │
│  │ diagram_list, diagram_get, diagram_create, diagram_update,  │   │
│  │ diagram_delete, diagram_analyze, diagram_import             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Hybrid React Micro-App via Vite

**How it works:**
- New source directory: `web/architecture-app/` contains React + TypeScript source
- Vite builds it into a single self-contained bundle: `web/public/js/bundles/architecture.js`
- The vanilla JS page (`web/public/js/pages/architecture.js`) creates a mount div and loads the bundle
- The React app mounts into that div with a simple `window.GuardianArchitecture.mount(element, config)` API
- When navigating away, the vanilla JS page calls `window.GuardianArchitecture.unmount()` to clean up

**Why Vite:**
- Fast builds, native ESM, tree-shaking
- Library mode outputs a single IIFE/UMD bundle — no chunk splitting, one file to serve
- Dev server with HMR for developing the React app independently
- No impact on GuardianAgent's existing `tsc` backend build

**Bundle contents (self-contained):**
- React 18 + ReactDOM (~45KB gzipped)
- @xyflow/react (~35KB gzipped)
- @mui/material + @emotion (~80KB gzipped)
- Ported Context Cypher components (~30KB gzipped)
- **Total: ~190KB gzipped** — loaded only on the Architecture page

### 2. What to Port from Context Cypher

**Port (core diagram engine):**
- `IconOnlyNode.tsx` — main node renderer (390 lines)
- `EditableSecurityEdge.tsx` — edge renderer with control points
- `SecurityZoneNode.tsx` — compound zone containers
- `ShapeNode.tsx` — custom shape rendering
- `NodeToolbox.tsx` — node palette with drag-and-drop (~300 lines, MUI-heavy but keeps MUI)
- `NodeEditor.tsx` — node property editing panel
- `EdgeEditor.tsx` — edge property editing panel
- `SecurityTypes.ts` — all type definitions (1753 lines)
- `Theme.ts` — zone colors, node colors
- `iconSerialization.ts` — icon save/load
- `edgePathUtils.ts` + `floatingEdgeUtils.ts` — edge routing math
- `ShapeTypes.ts` — 30 shape definitions

**Strip out (not in scope):**
- `AnalysisContextProvider` / `AIRequestService` / `AnalysisService` — AI integration
- `DiagramGenerationService` — AI diagram generation
- `ThreatAnalysisMainPanel` / `AnalysisPanel` — AI analysis UI
- `GrcWorkspaceService` / GRC types — governance/risk/compliance
- `LicenseService` — licensing
- `DiagramSanitizer` — replace with pass-through

**Adapt (connect to GuardianAgent):**
- Save/load → REST API calls to `/api/architecture/*` instead of FileSystem API
- Settings → simplified SettingsContext (theme, grid, snap — no license, no AI config)
- WindowManager → keep as-is (purely local React state, portable)
- ManualAnalysisContext → keep (pure client-side heuristic analysis, no backend)

### 3. Communication: React App ↔ Vanilla JS Shell

```
Vanilla JS Shell                    React Micro-App
─────────────────                   ─────────────────
                    mount(el, cfg)
architecture.js  ─────────────────▶  ArchitectureApp.tsx
                                     │
                    cfg.apiBase       │  fetch('/api/architecture/...')
                    cfg.token         │  (uses GuardianAgent REST API)
                                     │
                    CustomEvent       │
                  ◀─────────────────  │  dispatches 'diagram-changed'
SSE listener     ─────────────────▶  │  receives 'diagram-invalidate'
(app.js)           CustomEvent        │
```

**Mount API:**
```javascript
// Exposed by the bundle on window.GuardianArchitecture
window.GuardianArchitecture.mount(containerElement, {
  apiBase: '/api/architecture',
  token: sessionStorage.getItem('guardianagent_token'),
  diagramId: urlParams.get('id'),  // optional: open specific diagram
  onNavigate: (path) => { window.location.hash = path; },
});

window.GuardianArchitecture.unmount();
```

### 4. Full 200+ Node Types

Port all node types as TypeScript string literal unions from Context Cypher's `SecurityTypes.ts`. Zero runtime cost, required for JSON interop between the two apps.

### 5. Storage: JSON Files

**Location:** `~/.guardianagent/architecture/{diagram-id}.json`
**Index:** `~/.guardianagent/architecture/_index.json`

Same pattern as scheduled-tasks and memory files.

### 6. Keep MUI in the Bundle

Context Cypher components are heavily MUI-dependent (56/65 components). Stripping MUI would require rewriting ~30-40% of component code. Since the bundle is self-contained and doesn't leak styles to other pages, keeping MUI is pragmatic. Scoped styles via Emotion (MUI's CSS-in-JS) ensure zero conflicts with GuardianAgent's vanilla CSS.

---

## Data Model

**New module: `src/diagram/`** (backend TypeScript, compiled by existing `tsc`)

### Core Types (`src/diagram/types.ts`)

Ported from Context Cypher's `SecurityTypes.ts` — stripped of React-specific fields:

```typescript
type SecurityZone = 'Internet' | 'External' | 'DMZ' | ... (30 zones)
type DataClassification = 'Public' | 'Internal' | 'Sensitive' | 'Confidential'
type NodeShape = 'rectangle' | 'rounded-rectangle' | ... (30 shapes)
type SecurityNodeType = InfrastructureNodeType | SecurityControlNodeType | ... (200+ types)

interface DiagramNode {
  id: string;
  type: SecurityNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    zone: SecurityZone;
    dataClassification: DataClassification;
    protocols?: string[];
    securityControls?: string[];
    vendor?: string; product?: string; version?: string;
    shape?: NodeShape;
    icon?: string;            // String ID, never React component
    zoneType?: SecurityZone;  // For zone container nodes
  };
  parentId?: string;           // Zone containment (ReactFlow parent)
  style?: { width?: number; height?: number; background?: string };
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  data: {
    label?: string; protocol?: string; encryption?: string;
    description?: string; zone?: SecurityZone;
    dataClassification?: DataClassification;
    portRange?: string; securityControls?: string[];
  };
  style?: { stroke?: string; strokeWidth?: number; strokeDasharray?: string };
}

interface SecurityDiagram {
  id: string;
  name: string;
  description: string;
  category?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  metadata?: {
    createdAt: number; updatedAt: number; version: string;
    source?: 'manual' | 'cloud-discovery' | 'import' | 'agent-generated';
  };
}
```

### Context Cypher Interop (`src/diagram/interop.ts`)

- `fromContextCypher(json)` — normalizes icon fields, maps ReactFlow Node → DiagramNode
- `toContextCypher(diagram)` — outputs JSON in Context Cypher's format

---

## Agent Tools (7 tools, category: `diagram`)

All deferred-loaded. Registered in `src/tools/executor.ts`.

| Tool | Risk | Purpose |
|------|------|---------|
| `diagram_list` | read_only | List saved diagrams |
| `diagram_get` | read_only | Get full diagram by ID |
| `diagram_create` | mutating | Create diagram with nodes/edges |
| `diagram_update` | mutating | Add/remove/update nodes and edges |
| `diagram_delete` | mutating | Delete a diagram |
| `diagram_analyze` | read_only | Topology analysis: security gaps, zone violations, connectivity |
| `diagram_import` | mutating | Import from Context Cypher JSON or Mermaid |

**Cloud discovery** is agent-orchestrated: the LLM calls existing cloud tools then `diagram_create`/`diagram_update`. System prompt teaches this workflow.

### Key Tool Parameters

**`diagram_create`**: `{ name, description, category?, nodes?, edges? }`
**`diagram_update`**: `{ id, addNodes?, removeNodeIds?, addEdges?, removeEdgeIds?, updateNodes? }`
**`diagram_analyze`**: `{ id, analysisType: 'topology'|'security_gaps'|'zone_violations'|'connectivity' }`
**`diagram_import`**: `{ format: 'contextcypher'|'mermaid', content, name? }`

---

## REST API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/architecture` | List all diagrams |
| GET | `/api/architecture/:id` | Get diagram by ID |
| POST | `/api/architecture` | Create new diagram |
| PUT | `/api/architecture/:id` | Update diagram |
| DELETE | `/api/architecture/:id` | Delete diagram |
| POST | `/api/architecture/import` | Import from external format |
| GET | `/api/architecture/:id/export` | Export in Context Cypher format |
| POST | `/api/architecture/:id/analyze` | Run topology analysis |

---

## Web Panel: Architecture (`#/architecture`)

### Vanilla JS Shell (`web/public/js/pages/architecture.js`)

Lightweight wrapper that:
1. Renders a full-height container div
2. Loads `architecture.bundle.js` (if not already loaded)
3. Calls `window.GuardianArchitecture.mount(container, config)`
4. On route change, calls `unmount()`

### React Micro-App (`web/architecture-app/`)

**Entry point:** `ArchitectureApp.tsx`
- Wraps in minimal providers: `ReactFlowProvider`, `ThemeProvider` (MUI), simplified `SettingsProvider`, `WindowManagerProvider`
- No `AnalysisContextProvider` (stripped)

**Layout (inside React):**
- **Left panel (250px):** Diagram list (fetched from API) + "New" button + import
- **Center:** ReactFlow canvas with ported Context Cypher nodes/edges/zones
- **Right panel (collapsible):** NodeEditor / EdgeEditor when item selected
- **Floating toolbar:** Zoom, fit, layout, export

**Canvas features (from Context Cypher):**
- Drag-and-drop from NodeToolbox (all 200+ node types by category)
- Compound nodes for security zones (colored backgrounds)
- Editable edge labels with protocol/encryption
- Control points for edge re-routing
- Grid snapping
- Undo/redo
- Copy/paste

**Auto-save:** Debounced saves to `/api/architecture/:id` on node/edge changes.

---

## Vite Build Configuration

**New file: `web/architecture-app/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  build: {
    outDir: '../public/js/bundles',
    lib: {
      entry: 'src/main.tsx',
      name: 'GuardianArchitecture',
      fileName: () => 'architecture.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        // Single file, no code splitting
        inlineDynamicImports: true,
      },
    },
  },
});
```

**Build script** (added to package.json):
```json
{
  "scripts": {
    "build:architecture": "vite build --config web/architecture-app/vite.config.ts",
    "dev:architecture": "vite dev --config web/architecture-app/vite.config.ts",
    "build": "tsc && npm run build:architecture"
  }
}
```

---

## Files to Create

### Backend (`src/diagram/`)
| File | Purpose |
|------|---------|
| `src/diagram/types.ts` | All type definitions (ported from SecurityTypes.ts) |
| `src/diagram/diagram-store.ts` | JSON file-based CRUD |
| `src/diagram/diagram-store.test.ts` | Unit tests |
| `src/diagram/interop.ts` | Context Cypher JSON converters |
| `src/diagram/interop.test.ts` | Interop tests |
| `src/diagram/node-catalog.ts` | Node type registry (default shapes, icons per type) |
| `src/diagram/analyzer.ts` | Topology analysis logic |
| `src/diagram/index.ts` | Barrel export |

### React Micro-App (`web/architecture-app/`)
| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite build config (library mode, IIFE output) |
| `package.json` | React app dependencies (react, @xyflow/react, @mui/material) |
| `tsconfig.json` | TypeScript config for React (JSX, DOM types) |
| `src/main.tsx` | Entry point — exposes mount/unmount on window |
| `src/ArchitectureApp.tsx` | Root component with providers |
| `src/DiagramCanvas.tsx` | ReactFlow canvas (adapted from DiagramEditor) |
| `src/components/nodes/IconOnlyNode.tsx` | Ported from Context Cypher |
| `src/components/nodes/SecurityZoneNode.tsx` | Ported from Context Cypher |
| `src/components/nodes/ShapeNode.tsx` | Ported from Context Cypher |
| `src/components/edges/EditableSecurityEdge.tsx` | Ported from Context Cypher |
| `src/components/NodeToolbox.tsx` | Ported from Context Cypher |
| `src/components/NodeEditor.tsx` | Ported from Context Cypher (stripped of AI) |
| `src/components/EdgeEditor.tsx` | Ported from Context Cypher |
| `src/components/DiagramList.tsx` | New — fetches from /api/architecture |
| `src/components/Toolbar.tsx` | New — zoom, fit, layout, export buttons |
| `src/contexts/SettingsContext.tsx` | Simplified (theme, grid, snap — no license/AI) |
| `src/contexts/WindowManagerContext.tsx` | Ported as-is |
| `src/hooks/useApi.ts` | REST API client for GuardianAgent endpoints |
| `src/utils/iconSerialization.ts` | Ported from Context Cypher |
| `src/utils/edgePathUtils.ts` | Ported from Context Cypher |
| `src/utils/floatingEdgeUtils.ts` | Ported from Context Cypher |
| `src/types/SecurityTypes.ts` | Shared types (same as backend) |
| `src/theme.ts` | MUI theme + zone/node colors |

### Web Shell
| File | Purpose |
|------|---------|
| `web/public/js/pages/architecture.js` | Vanilla JS page — loads bundle, mounts React app |

## Files to Modify

| File | Change |
|------|--------|
| `src/tools/types.ts` | Add `'diagram'` to `ToolCategory`, metadata, tool names |
| `src/tools/executor.ts` | Register 7 diagram tools |
| `src/channels/web-types.ts` | Add diagram callbacks to `DashboardCallbacks` |
| `src/channels/web.ts` | Add `/api/architecture/*` route handlers |
| `src/index.ts` | Instantiate `DiagramStore`, wire dashboard callbacks |
| `web/public/index.html` | Add "Architecture" sidebar nav item |
| `web/public/js/app.js` | Add `/architecture` route, import page module |
| `web/public/js/api.js` | Add diagram API client methods (used by vanilla shell) |
| `web/public/css/style.css` | Minimal CSS for architecture page container |
| `package.json` | Add `build:architecture` and `dev:architecture` scripts, add vite devDependency |
| `src/reference-guide.ts` | Add Architecture section |

---

## Implementation Phases

### Phase 1: Backend Data Model & Storage
- `src/diagram/types.ts` — port all types from Context Cypher's SecurityTypes.ts
- `src/diagram/node-catalog.ts` — node type metadata (default shape, icon per type)
- `src/diagram/diagram-store.ts` — file-based CRUD with index
- `src/diagram/interop.ts` — Context Cypher JSON converters
- Tests for store and interop

### Phase 2: Agent Tools & API
- Add `'diagram'` category to `src/tools/types.ts`
- Register 7 tools in `src/tools/executor.ts`
- `src/diagram/analyzer.ts` — topology analysis logic
- Add diagram callbacks to `DashboardCallbacks` in `web-types.ts`
- Add API route handlers in `web.ts`
- Wire callbacks in `src/index.ts` bootstrap

### Phase 3: Vite Build Setup
- Create `web/architecture-app/` directory structure
- Set up `vite.config.ts` (library mode, IIFE output)
- Set up `package.json` with React, ReactFlow, MUI dependencies
- Set up `tsconfig.json` for React JSX
- Create `src/main.tsx` entry point with `mount()`/`unmount()` API
- Create minimal `ArchitectureApp.tsx` with providers
- Verify build produces `web/public/js/bundles/architecture.js`
- Add build scripts to root `package.json`

### Phase 4: Port Context Cypher Components
- Port node components: `IconOnlyNode`, `SecurityZoneNode`, `ShapeNode`
- Port edge component: `EditableSecurityEdge`
- Port utilities: `iconSerialization`, `edgePathUtils`, `floatingEdgeUtils`
- Port `NodeToolbox` (node palette with all 200+ types)
- Port `NodeEditor` and `EdgeEditor` (strip AI/GRC references)
- Create simplified `SettingsContext` and `WindowManagerContext`
- Port `Theme.ts` (zone colors, node colors)
- Create `DiagramCanvas.tsx` — adapted from DiagramEditor (core canvas logic only)

### Phase 5: Web Shell Integration
- Create `web/public/js/pages/architecture.js` (vanilla JS wrapper)
- Add sidebar nav item to `index.html`
- Add route to `app.js`
- Create `DiagramList.tsx` component (fetches from API)
- Create `Toolbar.tsx` (zoom, fit, layout, export)
- Create `useApi.ts` hook for REST calls
- Wire auto-save, SSE invalidation, diagram switching
- Add `architecture` SSE invalidation topic

### Phase 6: Cloud Discovery & Polish
- Add system prompt guidance for agent-orchestrated cloud → diagram workflow
- Add "Generate Architecture Diagram" action in Cloud page
- Port 3-5 example diagrams from Context Cypher's `src/data/exampleSystems.ts`
- Update reference guide

---

## Source Files Reference (Context Cypher)

Components to port from `/mnt/s/Development/contextcypher/src/`:

| Source File | Lines | Destination | Notes |
|-------------|-------|-------------|-------|
| `types/SecurityTypes.ts` | 1753 | `src/diagram/types.ts` + `web/architecture-app/src/types/` | Strip React imports, keep all type unions |
| `components/nodes/IconOnlyNode.tsx` | 390 | Port directly | Main node renderer, minimal deps |
| `components/SecurityZoneNode.tsx` | ~200 | Port directly | Compound node with resize |
| `components/nodes/ShapeNode.tsx` | ~150 | Port directly | Custom SVG shapes |
| `components/edges/EditableSecurityEdge.tsx` | ~300 | Port directly | Edge with labels + control points |
| `components/NodeToolbox.tsx` | ~300 | Port, adapt | Heavy MUI — keep MUI, strip AI tools |
| `components/NodeEditor.tsx` | ~400 | Port, strip AI | Remove threat analysis, keep properties |
| `components/EdgeEditor.tsx` | ~200 | Port directly | Edge property editing |
| `utils/iconSerialization.ts` | ~150 | Port directly | Icon string ↔ component mapping |
| `utils/edgePathUtils.ts` | ~200 | Port directly | SVG path math |
| `utils/floatingEdgeUtils.ts` | ~100 | Port directly | Dynamic edge connections |
| `styles/Theme.ts` | ~300 | Adapt | Extract zone/node colors, create MUI theme |
| `types/ShapeTypes.ts` | ~100 | Port directly | Shape definitions |
| `contexts/WindowManagerContext.tsx` | ~150 | Port as-is | Floating window state |
| `settings/SettingsContext.tsx` | ~400 | Simplify | Strip license, AI config; keep theme/grid/snap |

---

## Verification Plan

1. **Backend unit tests**: `npx vitest run src/diagram/` — DiagramStore CRUD, interop, analyzer
2. **Vite build**: `npm run build:architecture` — verify `web/public/js/bundles/architecture.js` is produced
3. **Bundle loads**: Open `#/architecture` in browser — verify React app mounts without errors
4. **Diagram CRUD via UI**: Create diagram, add nodes via toolbox, connect with edges, save, reload page, verify persistence
5. **Diagram CRUD via tools**: In CLI chat, ask agent to create a diagram — verify `diagram_create` tool works and diagram appears in web UI
6. **Context Cypher interop**: Export diagram, open JSON in Context Cypher; import Context Cypher JSON into GuardianAgent
7. **Agent workflow**: Ask LLM "map our AWS infrastructure" — verify it calls cloud tools then diagram tools to produce a viewable diagram
8. **No side effects**: Verify all other pages (Dashboard, Security, Cloud, etc.) still work correctly — no style leaks, no JS errors
