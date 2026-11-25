import { Check, Moon, Palette, Sun, Type } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import type { AccentColor, FontSizeOption, ThemeMode } from '../lib/supabase';

interface AppearanceControlsProps {
  compact?: boolean;
}

const MODE_OPTIONS: Array<{
  id: ThemeMode;
  label: string;
  sublabel: string;
  Icon: typeof Moon;
}> = [
  { id: 'dark', label: 'Trama Dark', sublabel: 'Carbón', Icon: Moon },
  { id: 'light', label: 'Trama Light', sublabel: 'Claro', Icon: Sun },
];

const ACCENT_OPTIONS: Array<{
  id: AccentColor;
  label: string;
  darkSwatch: string;
  lightSwatch: string;
}> = [
  {
    id: 'blue',
    label: 'Azul',
    darkSwatch: '#3B82F6',
    lightSwatch: '#2563EB',
  },
  {
    id: 'violet',
    label: 'Violeta',
    darkSwatch: '#8B5CF6',
    lightSwatch: '#7C3AED',
  },
];

const FONT_OPTIONS: Array<{
  id: FontSizeOption;
  label: string;
  px: string;
}> = [
  { id: 'normal', label: 'Normal', px: '16px' },
  { id: 'large', label: 'Grande', px: '18px' },
  { id: 'xl', label: 'Lectura XL', px: '20px' },
];

export function AppearanceControls({
  compact = false,
}: AppearanceControlsProps) {
  const {
    themeMode,
    accentColor,
    fontSize,
    setThemeMode,
    setAccentColor,
    setFontSize,
  } = useTheme();

  return (
    <div className={compact ? 'space-y-4' : 'space-y-5'}>
      {/* Modo de tema: Trama Dark / Trama Light */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
          {themeMode === 'dark' ? (
            <Moon size={13} aria-hidden="true" />
          ) : (
            <Sun size={13} aria-hidden="true" />
          )}
          <span>Tema</span>
        </div>
        <div
          role="radiogroup"
          aria-label="Seleccionar tema"
          className="grid grid-cols-2 gap-2"
        >
          {MODE_OPTIONS.map((option) => {
            const isSelected = themeMode === option.id;
            const Icon = option.Icon;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setThemeMode(option.id)}
                className={`min-h-[44px] flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  isSelected
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--text-main)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                <Icon
                  size={15}
                  className={
                    isSelected
                      ? 'text-[var(--accent-primary)]'
                      : 'text-[var(--text-muted)]'
                  }
                  aria-hidden="true"
                />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color de acento: Azul / Violeta */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
          <Palette size={13} aria-hidden="true" />
          <span>Color de acento</span>
        </div>
        <div
          role="radiogroup"
          aria-label="Seleccionar color de acento"
          className="grid grid-cols-2 gap-2"
        >
          {ACCENT_OPTIONS.map((option) => {
            const isSelected = accentColor === option.id;
            const swatchColor =
              themeMode === 'dark' ? option.darkSwatch : option.lightSwatch;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setAccentColor(option.id)}
                className={`min-h-[44px] flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  isSelected
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--text-main)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: swatchColor }}
                  />
                  <span>{option.label}</span>
                </span>
                {isSelected && (
                  <Check
                    size={14}
                    className="text-[var(--accent-primary)] shrink-0"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tamaño de letra para lectura */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <Type size={13} aria-hidden="true" />
            <span>Tamaño de lectura</span>
          </span>
          <span className="font-normal tabular-nums text-[var(--text-muted)]">
            {FONT_OPTIONS.find((f) => f.id === fontSize)?.px}
          </span>
        </div>
        <div
          role="radiogroup"
          aria-label="Seleccionar tamaño de letra"
          className="grid grid-cols-3 gap-1.5"
        >
          {FONT_OPTIONS.map((option) => {
            const isSelected = fontSize === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setFontSize(option.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-center transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
                  isSelected
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--text-main)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                <span className="text-xs font-semibold leading-tight">
                  {option.label}
                </span>
                <span className="mt-0.5 text-[10px] tabular-nums text-[var(--text-muted)]">
                  {option.px}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!compact && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3 transition-colors duration-300">
          <p className="text-[11px] font-medium text-[var(--text-muted)]">
            Vista previa de lectura
          </p>
          <p className="mt-1 reading-prose text-[var(--text-main)]">
            Las historias cobran vida cuando la lectura se adapta cómodamente a tu pantalla.
          </p>
        </div>
      )}
    </div>
  );
}
