import type { SubtitleSettings } from "~/types/database";

const STORAGE_KEY = "clipmafia-subtitle-settings";

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  fontName: "Courier New",
  fontSize: 16,
  primaryColor: "#FFFFFF",
  outlineColor: "#000000",
  bold: true,
  outline: 2,
  shadow: 1,
  marginV: 5,
  alignment: 2,
  animated: false,
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
        settings.value = {
          ...DEFAULT_SUBTITLE_SETTINGS,
          ...JSON.parse(stored),
        };
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
