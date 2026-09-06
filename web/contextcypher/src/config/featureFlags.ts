/**
 * Lightweight feature flags for the v2 uplift.
 *
 * Flags let v2 features ship dark on the main branch and be toggled during
 * development without rebuilding. Values are read from localStorage
 * (key: `featureFlag.<name>`) and fall back to the defaults below.
 *
 * Toggle from the browser console, e.g.:
 *   localStorage.setItem('featureFlag.v2Onboarding', 'true'); location.reload();
 */

export type FeatureFlagName =
  | 'v2Onboarding'   // Goal-based Get Started dialog + process spine (Phase 2)
  | 'v2Lenses'       // Canvas lenses: threats / attack paths / controls (Phase 3)
  | 'v2Register'     // Unified threat register panel (Phase 4)
  | 'grcOptIn';      // Hide GRC module until enabled in settings (Phase 4)

const DEFAULTS: Record<FeatureFlagName, boolean> = {
  // v2 experience defaults ON for the 2.0 branch; each can be disabled via
  // localStorage.setItem('featureFlag.<name>', 'false') if something misbehaves.
  v2Onboarding: true,
  v2Lenses: true,
  v2Register: true,
  // GRC stays visible until a proper opt-in toggle exists in Settings
  // (setting this true hides the GRC module buttons entirely).
  grcOptIn: false
};

const STORAGE_PREFIX = 'featureFlag.';

export const isFeatureEnabled = (flag: FeatureFlagName): boolean => {
  try {
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${flag}`);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    // localStorage unavailable (SSR/tests) – fall through to defaults
  }
  return DEFAULTS[flag];
};

export const setFeatureFlag = (flag: FeatureFlagName, enabled: boolean): void => {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${flag}`, String(enabled));
  } catch {
    // ignore
  }
};

export const getAllFeatureFlags = (): Record<FeatureFlagName, boolean> => {
  const result = {} as Record<FeatureFlagName, boolean>;
  (Object.keys(DEFAULTS) as FeatureFlagName[]).forEach(flag => {
    result[flag] = isFeatureEnabled(flag);
  });
  return result;
};
