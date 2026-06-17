const VALID_SHELL_LAYERS = new Set(['focused', 'classic', 'workstation']);

export const SHELL_LAYER_STORAGE_KEY = 'guardianagent_shell_layer';
export const LEGACY_WORKSTATION_MODE_KEY = 'guardianagent_workstation_mode';
export const SHELL_LAYER_EVENT = 'guardianagent:shell-layer-change';
export const LEGACY_WORKSTATION_MODE_EVENT = 'guardianagent:workstation-mode-change';
export const DEFAULT_SHELL_LAYER = 'focused';

export function normalizeShellLayer(value) {
  const candidate = String(value || '').trim().toLowerCase();
  if (candidate === 'web-browser' || candidate === 'browser' || candidate === 'desktop') {
    return 'workstation';
  }
  if (candidate === 'default') {
    return 'classic';
  }
  return VALID_SHELL_LAYERS.has(candidate) ? candidate : DEFAULT_SHELL_LAYER;
}

function canUseStorage() {
  return typeof localStorage !== 'undefined';
}

function canDispatchEvents() {
  return typeof window !== 'undefined' && typeof window.dispatchEvent === 'function';
}

function createShellEvent(name, detail) {
  if (typeof CustomEvent === 'function') {
    return new CustomEvent(name, { detail });
  }
  const event = new Event(name);
  event.detail = detail;
  return event;
}

export function getSavedShellLayer() {
  if (!canUseStorage()) return DEFAULT_SHELL_LAYER;

  const saved = localStorage.getItem(SHELL_LAYER_STORAGE_KEY);
  if (saved) return normalizeShellLayer(saved);

  const legacyWorkstation = localStorage.getItem(LEGACY_WORKSTATION_MODE_KEY);
  if (legacyWorkstation === 'true') return 'workstation';
  if (legacyWorkstation === 'false') return 'classic';

  return DEFAULT_SHELL_LAYER;
}

export function setSavedShellLayer(layer, options = {}) {
  const nextLayer = normalizeShellLayer(layer);
  if (canUseStorage()) {
    localStorage.setItem(SHELL_LAYER_STORAGE_KEY, nextLayer);
    localStorage.setItem(LEGACY_WORKSTATION_MODE_KEY, String(nextLayer === 'workstation'));
  }

  if (options.dispatch !== false && canDispatchEvents()) {
    window.dispatchEvent(createShellEvent(SHELL_LAYER_EVENT, { layer: nextLayer }));
    window.dispatchEvent(createShellEvent(LEGACY_WORKSTATION_MODE_EVENT, {
      active: nextLayer === 'workstation',
      layer: nextLayer,
    }));
  }

  return nextLayer;
}

export function readShellLayerFromEvent(event) {
  const detail = event?.detail || {};
  if (detail.layer) return normalizeShellLayer(detail.layer);
  if (typeof detail.active === 'boolean') return detail.active ? 'workstation' : 'classic';
  return getSavedShellLayer();
}
