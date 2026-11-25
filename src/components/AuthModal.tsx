import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type AuthTab = 'login' | 'register';

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Correo electrónico o contraseña incorrectos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Debes confirmar tu correo electrónico antes de iniciar sesión.';
  }
  if (lower.includes('user already registered')) {
    return 'Ya existe una cuenta registrada con este correo electrónico.';
  }
  if (lower.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (lower.includes('unable to validate email') || lower.includes('invalid email')) {
    return 'Ingresa un correo electrónico válido.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  }
  return message;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setInfoMsg(null);
    }
  }, [isOpen, tab]);

  if (!isOpen) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMsg('Ingresa un correo electrónico válido.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (error) {
          setErrorMsg(translateAuthError(error.message));
          return;
        }

        setPassword('');
        onClose();
        onSuccess?.();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });

        if (error) {
          setErrorMsg(translateAuthError(error.message));
          return;
        }

        setPassword('');

        if (data.session) {
          onClose();
          onSuccess?.();
        } else {
          setInfoMsg(
            'Cuenta creada. Revisa tu bandeja de entrada para confirmar tu correo electrónico e iniciar sesión.'
          );
          setTab('login');
        }
      }
    } catch {
      setErrorMsg('No se pudo conectar con el servicio de autenticación. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-t-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 pb-8 shadow-2xl transition-colors duration-300 sm:rounded-2xl sm:p-7">
        {/* Indicador táctil móvil */}
        <div
          aria-hidden="true"
          className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-[var(--border-subtle)] sm:hidden"
        />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="auth-modal-title"
              className="font-display text-2xl font-bold tracking-tight text-[var(--text-main)]"
            >
              {tab === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {tab === 'login'
                ? 'Accede a tu cuenta de Trama con tu correo y contraseña.'
                : 'Regístrate para configurar tu perfil y guardar tus preferencias.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Cerrar formulario"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Selector de pestaña Iniciar sesión / Registrarse */}
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1">
          <button
            type="button"
            onClick={() => setTab('login')}
            className={`min-h-[40px] rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
              tab === 'login'
                ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => setTab('register')}
            className={`min-h-[40px] rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
              tab === 'register'
                ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
            }`}
          >
            Registrarse
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label
              htmlFor="auth-email"
              className="mb-1.5 block text-sm font-medium text-[var(--text-main)]"
            >
              Correo electrónico
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@correo.com"
              className="min-h-[46px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="mb-1.5 block text-sm font-medium text-[var(--text-main)]"
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="min-h-[46px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] pl-3.5 pr-12 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              >
                {showPassword ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-700 dark:text-red-200"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500 dark:text-red-400" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 text-sm text-emerald-700 dark:text-emerald-200"
            >
              <CheckCircle2
                size={18}
                className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <span>{infoMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 min-h-[48px] w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-3 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-card)]"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                <span>{tab === 'login' ? 'Iniciando sesión…' : 'Creando cuenta…'}</span>
              </>
            ) : (
              <span>{tab === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
