import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  supabase,
  type AccentColor,
  type FontSizeOption,
  type ThemeMode,
} from '../lib/supabase';
import { useAuth } from './AuthContext';

export type TramaSection =
  | 'actualidad'
  | 'comunidad'
  | 'biblioteca'
  | 'arcade'
  | 'perfil';

export interface AppearancePreferences {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  fontSize: FontSizeOption;
}

interface ThemeContextValue extends AppearancePreferences {
  activeSection: TramaSection;
  setActiveSection: (section: TramaSection) => void;
  fontSizePx: number;
  isSyncingPrefs: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (accent: AccentColor) => void;
  setFontSize: (size: FontSizeOption) => void;
  updateAppearance: (patch: Partial<AppearancePreferences>) => void;
}

const STORAGE_KEY = 'trama_appearance_v1';

const DEFAULT_PREFS: AppearancePreferences = {
  themeMode: 'dark',
  accentColor: 'blue',
  fontSize: 'normal',
};

export const FONT_SIZE_PX_MAP: Record<FontSizeOption, number> = {
  normal: 16,
  large: 18,
  xl: 20,
};

function parseThemeMode(value: unknown): ThemeMode {
  return value === 'light' ? 'light' : 'dark';
}

function parseAccentColor(value: unknown): AccentColor {
  return value === 'violet' ? 'violet' : 'blue';
}

function parseFontSize(value: unknown): FontSizeOption {
  if (value === 'large' || value === '18') return 'large';
  if (value === 'xl' || value === '20') return 'xl';
  return 'normal';
}

function readLocalPreferences(): AppearancePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<AppearancePreferences>;
    return {
      themeMode: parseThemeMode(parsed.themeMode),
      accentColor: parseAccentColor(parsed.accentColor),
      fontSize: parseFontSize(parsed.fontSize),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writeLocalPreferences(prefs: AppearancePreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignora si el navegador restringe almacenamiento local
  }
}

function applyAppearanceToDom(
  prefs: AppearancePreferences,
  section: TramaSection
): void {
  const root = document.documentElement;
  root.classList.toggle('dark', prefs.themeMode === 'dark');
  root.dataset.theme = prefs.themeMode;
  root.dataset.accent = prefs.accentColor;
  root.dataset.fontSize = prefs.fontSize;
  root.dataset.section = section;

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute(
      'content',
      prefs.themeMode === 'dark' ? '#0F1115' : '#F8FAFC'
    );
  }
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile, profileExists, setProfileState } = useAuth();
  const [prefs, setPrefs] = useState<AppearancePreferences>(() =>
    readLocalPreferences()
  );
  const [activeSection, setActiveSectionState] =
    useState<TramaSection>('actualidad');
  const [isSyncingPrefs, setIsSyncingPrefs] = useState(false);

  const hydratedUserIdRef = useRef<string | null>(null);
  const prefsRef = useRef<AppearancePreferences>(prefs);
  const sectionRef = useRef<TramaSection>(activeSection);

  useEffect(() => {
    prefsRef.current = prefs;
    sectionRef.current = activeSection;
    applyAppearanceToDom(prefs, activeSection);
    writeLocalPreferences(prefs);
  }, [prefs, activeSection]);

  // Hidrata preferencias desde Supabase profiles al iniciar sesión
  useEffect(() => {
    if (!user?.id) {
      hydratedUserIdRef.current = null;
      return;
    }

    if (!profile || profile.id !== user.id || !profileExists) {
      return;
    }

    if (hydratedUserIdRef.current === user.id) {
      return;
    }

    hydratedUserIdRef.current = user.id;

    const remoteMode = profile.theme_mode
      ? parseThemeMode(profile.theme_mode)
      : prefsRef.current.themeMode;
    const remoteAccent = profile.accent_color
      ? parseAccentColor(profile.accent_color)
      : prefsRef.current.accentColor;
    const remoteFont = profile.font_size
      ? parseFontSize(profile.font_size)
      : prefsRef.current.fontSize;

    setPrefs((prev) => {
      if (
        prev.themeMode === remoteMode &&
        prev.accentColor === remoteAccent &&
        prev.fontSize === remoteFont
      ) {
        return prev;
      }
      return {
        themeMode: remoteMode,
        accentColor: remoteAccent,
        fontSize: remoteFont,
      };
    });
  }, [user?.id, profile, profileExists]);

  const persistRemotePreferences = useCallback(
    async (next: AppearancePreferences) => {
      if (!user?.id) return;
      setIsSyncingPrefs(true);
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            theme_mode: next.themeMode,
            accent_color: next.accentColor,
            font_size: next.fontSize,
          })
          .eq('id', user.id);

        if (!error && profile && profile.id === user.id) {
          setProfileState(
            {
              ...profile,
              theme_mode: next.themeMode,
              accent_color: next.accentColor,
              font_size: next.fontSize,
            },
            profileExists
          );
        }
      } catch {
        // Conserva la preferencia localmente aunque falle la sincronización remota
      } finally {
        setIsSyncingPrefs(false);
      }
    },
    [user?.id, profile, profileExists, setProfileState]
  );

  const setActiveSection = useCallback((section: TramaSection) => {
    if (sectionRef.current === section) return;
    sectionRef.current = section;
    setActiveSectionState(section);
    applyAppearanceToDom(prefsRef.current, section);
  }, []);

  const updateAppearance = useCallback(
    (patch: Partial<AppearancePreferences>) => {
      const next: AppearancePreferences = {
        ...prefsRef.current,
        ...patch,
      };
      prefsRef.current = next;
      setPrefs(next);
      applyAppearanceToDom(next, sectionRef.current);
      writeLocalPreferences(next);
      void persistRemotePreferences(next);
    },
    [persistRemotePreferences]
  );

  const setThemeMode = useCallback(
    (themeMode: ThemeMode) => {
      updateAppearance({ themeMode });
    },
    [updateAppearance]
  );

  const setAccentColor = useCallback(
    (accentColor: AccentColor) => {
      updateAppearance({ accentColor });
    },
    [updateAppearance]
  );

  const setFontSize = useCallback(
    (fontSize: FontSizeOption) => {
      updateAppearance({ fontSize });
    },
    [updateAppearance]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...prefs,
      activeSection,
      setActiveSection,
      fontSizePx: FONT_SIZE_PX_MAP[prefs.fontSize],
      isSyncingPrefs,
      setThemeMode,
      setAccentColor,
      setFontSize,
      updateAppearance,
    }),
    [
      prefs,
      activeSection,
      setActiveSection,
      isSyncingPrefs,
      setThemeMode,
      setAccentColor,
      setFontSize,
      updateAppearance,
    ]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe utilizarse dentro de un ThemeProvider.');
  }
  return context;
}
