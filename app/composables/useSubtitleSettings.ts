import type { SubtitleSettings } from "~/types/database";
import { DEFAULT_SUBTITLE_STYLE } from "~/lib/overlayConfig";

const STORAGE_KEY = "clipmafia-subtitle-settings";

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  fontName: DEFAULT_SUBTITLE_STYLE.fontName,
  fontSize: DEFAULT_SUBTITLE_STYLE.fontSize,
  primaryColor: DEFAULT_SUBTITLE_STYLE.primaryColor,
  outlineColor: DEFAULT_SUBTITLE_STYLE.outlineColor,
  bold: DEFAULT_SUBTITLE_STYLE.bold,
  outline: DEFAULT_SUBTITLE_STYLE.outline,
  shadow: DEFAULT_SUBTITLE_STYLE.shadow,
  marginV: DEFAULT_SUBTITLE_STYLE.marginV,
  alignment: DEFAULT_SUBTITLE_STYLE.alignment,
};

/**
 * Global subtitle settings composable.
 * Settings are persisted in localStorage and shared across all pages.
 */
export function useSubtitleSettings() {
  const settings = useState<SubtitleSettings>("globalSubtitleSettings", () => ({
    ...DEFAULT_SUBTITLE_SETTINGS,
  }));

  const loaded = useState<boolean>("subtitleSettingsLoaded", () => false);

  /** Load settings from localStorage (client-only). */
  function load() {
    if (!import.meta.client) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Migration guard: old settings used "phone pixels" (typical fontSize: 8–32).
        // New system uses video pixels (1080×1920), so fontSize should be ≥ 16.
        // If the stored value is too small, it's a stale setting — reset to defaults.
        if (typeof parsed.fontSize === "number" && parsed.fontSize < 16) {
          console.log(
            "[useSubtitleSettings] Stale settings detected (fontSize=" +
              parsed.fontSize +
              "), resetting to defaults",
          );
          settings.value = { ...DEFAULT_SUBTITLE_SETTINGS };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value));
        } else {
          settings.value = {
            ...DEFAULT_SUBTITLE_SETTINGS,
            ...parsed,
          };
        }
      }
    } catch {
      // ignore parse errors
    }
    loaded.value = true;
  }

  /** Save current settings to localStorage. */
  function save(newSettings?: SubtitleSettings) {
    if (newSettings) {
      settings.value = { ...newSettings };
    }
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value));
    }
  }

  /** Reset to default values and persist. */
  function reset() {
    settings.value = { ...DEFAULT_SUBTITLE_SETTINGS };
    save();
  }

  /** Check if settings have been customized (differ from defaults). */
  function isCustomized(): boolean {
    return (
      JSON.stringify(settings.value) !==
      JSON.stringify(DEFAULT_SUBTITLE_SETTINGS)
    );
  }

  // Auto-load on client
  if (import.meta.client && !loaded.value) {
    load();
  }

  return {
    settings,
    loaded,
    load,
    save,
    reset,
    isCustomized,
    DEFAULT_SUBTITLE_SETTINGS,
  };
}
