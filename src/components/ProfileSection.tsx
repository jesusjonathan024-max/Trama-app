import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  AlertCircle,
  Award,
  Camera,
  Check,
  CheckCircle2,
  Crown,
  FileText,
  Loader2,
  LogOut,
  MessageSquare,
  Palette,
  RefreshCw,
  Save,
  Search,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  fetchAllMembers,
  fetchOwnerStats,
  updateMemberBadge,
  type MemberDirectoryItem,
  type OwnerPlatformStats,
} from '../lib/posts';
import {
  MEDIA_BUCKET,
  MEMBER_BADGE_OPTIONS,
  isSafeHttpUrl,
  supabase,
} from '../lib/supabase';
import { AppearanceControls } from './AppearanceControls';
import { Avatar } from './Avatar';
import { OwnerBadge } from './OwnerBadge';

interface ProfileSectionProps {
  onOpenAuth: () => void;
  onSignedOut: () => void;
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_USERNAME_LENGTH = 40;
const MAX_BIO_LENGTH = 300;

export function ProfileSection({
  onOpenAuth,
  onSignedOut,
}: ProfileSectionProps) {
  const {
    user,
    profile,
    profileExists,
    isAuthenticated,
    isOwner,
    isLoadingSession,
    isLoadingProfile,
    setProfileState,
    signOut,
  } = useAuth();
  const { isSyncingPrefs } = useTheme();

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const [ownerStats, setOwnerStats] = useState<OwnerPlatformStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [members, setMembers] = useState<MemberDirectoryItem[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [savedMemberId, setSavedMemberId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setUsername(profile?.username ?? '');
    setBio(profile?.bio ?? '');
    setAvatarUrl(profile?.avatar_url ?? null);
  }, [profile]);

  const loadOwnerPanelData = useCallback(async () => {
    if (!isOwner) return;
    setIsLoadingStats(true);
    setIsLoadingMembers(true);
    setStatsError(null);
    setMembersError(null);

    const [statsRes, membersRes] = await Promise.allSettled([
      fetchOwnerStats(),
      fetchAllMembers(),
    ]);

    if (statsRes.status === 'fulfilled') {
      setOwnerStats(statsRes.value);
    } else {
      setStatsError(
        statsRes.reason instanceof Error
          ? statsRes.reason.message
          : 'No se pudieron consultar las estadísticas.'
      );
    }
    setIsLoadingStats(false);

    if (membersRes.status === 'fulfilled') {
      setMembers(membersRes.value);
    } else {
      setMembersError(
        membersRes.reason instanceof Error
          ? membersRes.reason.message
          : 'No se pudo cargar la lista de usuarios registrados.'
      );
    }
    setIsLoadingMembers(false);
  }, [isOwner]);

  useEffect(() => {
    if (!isOwner) {
      setOwnerStats(null);
      setMembers([]);
      return;
    }
    void loadOwnerPanelData();
  }, [isOwner, loadOwnerPanelData]);

  async function handleAssignMemberBadge(memberId: string, rawValue: string) {
    if (!isOwner || updatingMemberId) return;
    const nextBadge = rawValue.trim() ? rawValue.trim() : null;

    setUpdatingMemberId(memberId);
    setMembersError(null);
    setSavedMemberId(null);

    try {
      const updated = await updateMemberBadge(memberId, nextBadge);
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, badge: updated.badge } : m
        )
      );
      if (user && memberId === user.id && profile) {
        setProfileState(
          {
            ...profile,
            badge: updated.badge,
          },
          true
        );
      }
      setSavedMemberId(memberId);
      window.setTimeout(() => {
        setSavedMemberId((curr) => (curr === memberId ? null : curr));
      }, 2200);
    } catch (err) {
      setMembersError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la insignia del usuario.'
      );
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function persistProfileRow(payload: {
    username: string | null;
    bio: string | null;
    avatar_url: string | null;
  }) {
    if (!user) {
      throw new Error('No hay una sesión activa.');
    }

    if (profileExists) {
      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
        .select('id, username, bio, avatar_url, role, badge, theme_mode, accent_color, font_size')
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        setProfileState(
          {
            id: data.id,
            username: data.username ?? null,
            bio: data.bio ?? null,
            avatar_url: data.avatar_url ?? null,
            role: data.role ?? profile?.role ?? null,
            badge: data.badge ?? profile?.badge ?? null,
            theme_mode: data.theme_mode ?? profile?.theme_mode ?? null,
            accent_color: data.accent_color ?? profile?.accent_color ?? null,
            font_size: data.font_size ?? profile?.font_size ?? null,
          },
          true
        );
        return;
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          ...payload,
        },
        { onConflict: 'id' }
      )
      .select('id, username, bio, avatar_url, role, badge, theme_mode, accent_color, font_size')
      .single();

    if (error) {
      throw error;
    }

    setProfileState(
      {
        id: data.id,
        username: data.username ?? null,
        bio: data.bio ?? null,
        avatar_url: data.avatar_url ?? null,
        role: data.role ?? profile?.role ?? null,
        badge: data.badge ?? profile?.badge ?? null,
        theme_mode: data.theme_mode ?? profile?.theme_mode ?? null,
        accent_color: data.accent_color ?? profile?.accent_color ?? null,
        font_size: data.font_size ?? profile?.font_size ?? null,
      },
      true
    );
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;

    setFeedback(null);

    const fileExt = ALLOWED_IMAGE_TYPES[file.type];
    if (!fileExt) {
      setFeedback({
        type: 'error',
        message: 'Formato no permitido. Usa una imagen JPG, PNG, WebP o GIF.',
      });
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setFeedback({
        type: 'error',
        message: 'La imagen supera el límite de 5 MB. Elige un archivo más liviano.',
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(filePath);

      if (!isSafeHttpUrl(publicUrl)) {
        throw new Error('No se pudo obtener una URL válida para la imagen subida.');
      }

      setAvatarUrl(publicUrl);

      await persistProfileRow({
        username: username.trim() || null,
        bio: bio.trim() || null,
        avatar_url: publicUrl,
      });

      setFeedback({
        type: 'success',
        message: 'Foto de perfil actualizada y guardada correctamente.',
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error && err.message
          ? err.message
          : 'No se pudo subir la imagen. Inténtalo nuevamente.';
      setFeedback({
        type: 'error',
        message: `Error al subir la foto: ${errorMessage}`,
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    setFeedback(null);

    const cleanedUsername = username.trim();
    const cleanedBio = bio.trim();

    if (cleanedUsername.length > 0 && cleanedUsername.length < 2) {
      setFeedback({
        type: 'error',
        message: 'El nombre de usuario debe tener al menos 2 caracteres.',
      });
      return;
    }

    if (cleanedUsername.length > MAX_USERNAME_LENGTH) {
      setFeedback({
        type: 'error',
        message: `El nombre de usuario no puede superar los ${MAX_USERNAME_LENGTH} caracteres.`,
      });
      return;
    }

    if (cleanedBio.length > MAX_BIO_LENGTH) {
      setFeedback({
        type: 'error',
        message: `La biografía no puede superar los ${MAX_BIO_LENGTH} caracteres.`,
      });
      return;
    }

    setIsSaving(true);

    try {
      await persistProfileRow({
        username: cleanedUsername || null,
        bio: cleanedBio || null,
        avatar_url: isSafeHttpUrl(avatarUrl) ? avatarUrl : null,
      });

      setFeedback({
        type: 'success',
        message: 'Tu perfil se actualizó correctamente.',
      });
    } catch (err: unknown) {
      const pgCode =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';

      if (pgCode === '23505') {
        setFeedback({
          type: 'error',
          message: 'Ese nombre de usuario ya está en uso. Prueba con otro.',
        });
      } else {
        const message =
          typeof err === 'object' &&
          err !== null &&
          'message' in err &&
          typeof (err as { message?: unknown }).message === 'string'
            ? (err as { message: string }).message
            : 'Ocurrió un error al guardar los cambios.';
        setFeedback({
          type: 'error',
          message,
        });
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setFeedback(null);
    const { error } = await signOut();
    setIsSigningOut(false);
    if (error) {
      setFeedback({
        type: 'error',
        message: `No se pudo cerrar sesión: ${error}`,
      });
      return;
    }
    onSignedOut();
  }

  if (isLoadingSession) {
    return (
      <section className="mx-auto max-w-4xl px-5 py-10 md:px-8 md:py-14">
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-44 rounded-lg bg-[var(--bg-elevated)]" />
          <div className="h-64 w-full rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)]" />
        </div>
      </section>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <section className="mx-auto max-w-xl px-5 py-12 space-y-8">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-12 text-center transition-colors duration-300">
          <h1 className="text-balance font-display text-3xl font-bold tracking-tight text-[var(--text-main)]">
            Mi Perfil
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[var(--text-secondary)]">
            Inicia sesión o crea una cuenta para editar tu nombre de usuario, tu biografía, tu foto y sincronizar tus preferencias de apariencia.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-7 min-h-[48px] rounded-xl bg-[var(--accent-primary)] px-5 py-3 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          >
            Iniciar sesión / Registrarse
          </button>
        </div>

        {/* Ajustes de apariencia disponibles también antes de iniciar sesión */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 transition-colors duration-300">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Palette size={18} aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-main)]">
                Apariencia y Lectura
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Personaliza el tema, color de acento y tamaño de letra en este dispositivo.
              </p>
            </div>
          </div>
          <AppearanceControls />
        </div>
      </section>
    );
  }

  const hasUnsavedChanges =
    username.trim() !== (profile?.username ?? '').trim() ||
    bio.trim() !== (profile?.bio ?? '').trim();

  return (
    <section
      aria-labelledby="profile-heading"
      className="mx-auto max-w-4xl px-4 py-8 pb-24 sm:px-6 md:px-8 md:py-12 md:pb-16"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-[var(--border-subtle)] pb-6 transition-colors duration-300">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1
              id="profile-heading"
              className="font-display text-3xl font-bold tracking-tight text-[var(--text-main)]"
            >
              Mi Perfil
            </h1>
            <OwnerBadge role={profile?.role} badge={profile?.badge} size="md" />
          </div>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            Administra tu información pública, tu foto y tus preferencias de lectura.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="mt-3 sm:mt-0 min-h-[44px] self-start sm:self-auto inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-elevated)] disabled:opacity-60 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
        >
          {isSigningOut ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <LogOut size={16} aria-hidden="true" />
          )}
          <span>Cerrar sesión</span>
        </button>
      </div>

      {/* Tarjeta de Apariencia y Lectura (sincronizada con Supabase profiles) */}
      <div
        aria-labelledby="appearance-heading"
        className="mt-7 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-sm transition-colors duration-300"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Palette size={18} aria-hidden="true" />
            </div>
            <div>
              <h2
                id="appearance-heading"
                className="font-display text-lg font-bold tracking-tight text-[var(--text-main)]"
              >
                Apariencia y Lectura
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Tus preferencias se guardan automáticamente en tu cuenta de Trama.
              </p>
            </div>
          </div>

          {isSyncingPrefs && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-primary)]">
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              <span>Guardando…</span>
            </span>
          )}
        </div>

        <AppearanceControls />
      </div>

      {/* Panel privado de estadísticas del Dueño (visible exclusivamente para role === 'owner') */}
      {isOwner && (
        <div
          aria-labelledby="owner-stats-heading"
          className="mt-7 rounded-2xl border border-amber-500/35 dark:border-amber-400/25 bg-[var(--bg-card)] p-5 sm:p-6 shadow-sm transition-colors duration-300"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/12 text-amber-600 dark:text-amber-300">
                <Crown size={18} aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="owner-stats-heading"
                  className="font-display text-lg font-bold tracking-tight text-[var(--text-main)]"
                >
                  Panel del Dueño
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Resumen general privado de Trama · Solo visible para tu cuenta
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadOwnerPanelData()}
              disabled={isLoadingStats || isLoadingMembers}
              aria-label="Actualizar panel del Dueño"
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            >
              <RefreshCw
                size={14}
                className={
                  isLoadingStats || isLoadingMembers ? 'animate-spin' : ''
                }
                aria-hidden="true"
              />
              <span>Actualizar</span>
            </button>
          </div>

          {statsError ? (
            <div
              role="alert"
              className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-200"
            >
              <AlertCircle
                size={15}
                className="shrink-0 text-red-500 dark:text-red-400"
                aria-hidden="true"
              />
              <span>{statsError}</span>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-4 transition-colors duration-300">
                <div className="flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
                  <span>Usuarios registrados</span>
                  <Users
                    size={15}
                    className="text-amber-600 dark:text-amber-300"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 font-display text-3xl font-bold tabular-nums text-[var(--text-main)]">
                  {isLoadingStats && !ownerStats
                    ? '—'
                    : ownerStats?.totalUsers ?? 0}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-4 transition-colors duration-300">
                <div className="flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
                  <span>Publicaciones activas</span>
                  <FileText
                    size={15}
                    className="text-amber-600 dark:text-amber-300"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 font-display text-3xl font-bold tabular-nums text-[var(--text-main)]">
                  {isLoadingStats && !ownerStats
                    ? '—'
                    : ownerStats?.totalPosts ?? 0}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-4 transition-colors duration-300">
                <div className="flex items-center justify-between text-xs font-medium text-[var(--text-secondary)]">
                  <span>Comentarios</span>
                  <MessageSquare
                    size={15}
                    className="text-amber-600 dark:text-amber-300"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 font-display text-3xl font-bold tabular-nums text-[var(--text-main)]">
                  {isLoadingStats && !ownerStats
                    ? '—'
                    : ownerStats?.totalComments ?? 0}
                </p>
              </div>
            </div>
          )}

          {/* Gestión de Miembros e Insignias */}
          <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Award
                  size={17}
                  className="text-amber-600 dark:text-amber-300 shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-display text-base font-bold text-[var(--text-main)]">
                    Gestión de Miembros e Insignias
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Asigna o retira insignias visibles en Actualidad, Comunidad, Biblioteca y Arcade.
                  </p>
                </div>
              </div>

              <div className="relative w-full sm:w-56">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Buscar miembro…"
                  aria-label="Buscar miembro por nombre"
                  className="min-h-[40px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] pl-8 pr-3 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25"
                />
              </div>
            </div>

            {membersError && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-200"
              >
                <AlertCircle
                  size={15}
                  className="mt-0.5 shrink-0 text-red-500 dark:text-red-400"
                  aria-hidden="true"
                />
                <span>{membersError}</span>
              </div>
            )}

            <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {isLoadingMembers && members.length === 0 ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-14 rounded-xl bg-[var(--bg-subtle)]" />
                  <div className="h-14 rounded-xl bg-[var(--bg-subtle)]" />
                  <div className="h-14 rounded-xl bg-[var(--bg-subtle)]" />
                </div>
              ) : (() => {
                const query = memberSearch.trim().toLowerCase();
                const filteredMembers = query
                  ? members.filter((m) => {
                      const uname = (m.username ?? '').toLowerCase();
                      const bdg = (m.badge ?? '').toLowerCase();
                      return (
                        uname.includes(query) ||
                        bdg.includes(query) ||
                        m.id.toLowerCase().includes(query)
                      );
                    })
                  : members;

                if (filteredMembers.length === 0) {
                  return (
                    <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-6 text-center text-xs text-[var(--text-muted)]">
                      {query
                        ? 'No se encontraron usuarios con ese criterio.'
                        : 'Aún no hay miembros registrados.'}
                    </p>
                  );
                }

                return filteredMembers.map((member) => {
                  const isBusy = updatingMemberId === member.id;
                  const isJustSaved = savedMemberId === member.id;
                  const displayName =
                    member.username?.trim() ||
                    `Usuario ${member.id.slice(0, 6)}`;

                  return (
                    <div
                      key={member.id}
                      className="flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between transition-colors duration-300"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          src={member.avatar_url}
                          name={displayName}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-[var(--text-main)]">
                              {displayName}
                            </span>
                            {member.id === user.id && (
                              <span className="text-[11px] font-semibold text-[var(--accent-primary)]">
                                (Tú)
                              </span>
                            )}
                            <OwnerBadge
                              role={member.role}
                              badge={member.badge}
                              size="xs"
                            />
                          </div>
                          <p className="mt-0.5 text-[11px] text-[var(--text-muted)] tabular-nums">
                            ID: {member.id.slice(0, 8)}…
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isBusy && (
                          <Loader2
                            size={15}
                            className="animate-spin text-[var(--accent-primary)]"
                            aria-label="Guardando insignia"
                          />
                        )}
                        {isJustSaved && !isBusy && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
                            <Check size={13} aria-hidden="true" />
                            <span>Guardado</span>
                          </span>
                        )}
                        <label
                          htmlFor={`badge-select-${member.id}`}
                          className="sr-only"
                        >
                          Insignia para {displayName}
                        </label>
                        <select
                          id={`badge-select-${member.id}`}
                          value={member.badge ?? ''}
                          disabled={isBusy}
                          onChange={(event) =>
                            void handleAssignMemberBadge(
                              member.id,
                              event.target.value
                            )
                          }
                          className="min-h-[40px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25 disabled:opacity-50"
                        >
                          <option value="">Ninguna</option>
                          {MEMBER_BADGE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Columna izquierda: Foto de perfil e identidad de cuenta */}
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-sm transition-colors duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <Avatar
                  src={avatarUrl}
                  name={username || profile?.username}
                  email={user.email}
                  size="lg"
                />
                {isUploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/65">
                    <Loader2
                      size={24}
                      className="animate-spin text-white"
                      aria-label="Subiendo foto"
                    />
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 max-w-full">
                <h2 className="font-display text-lg font-semibold text-[var(--text-main)] max-w-full truncate">
                  {username.trim() || 'Sin nombre de usuario'}
                </h2>
                <OwnerBadge role={profile?.role} badge={profile?.badge} size="sm" />
              </div>

              <p className="mt-1 text-xs text-[var(--text-muted)] max-w-full truncate">
                {user.email}
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarChange}
                className="sr-only"
                aria-label="Seleccionar foto de perfil"
              />

              <button
                type="button"
                disabled={isUploadingAvatar || isLoadingProfile}
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-elevated)] disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              >
                {isUploadingAvatar ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    <span>Subiendo imagen…</span>
                  </>
                ) : (
                  <>
                    <Camera size={16} aria-hidden="true" />
                    <span>{avatarUrl ? 'Cambiar foto' : 'Subir foto'}</span>
                  </>
                )}
              </button>

              <p className="mt-3 text-xs text-[var(--text-muted)]">
                JPG, PNG, WebP o GIF · Máx. 5 MB
              </p>
            </div>
          </div>
        </div>

        {/* Columna derecha: Formulario de username y bio */}
        <div className="lg:col-span-8">
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 sm:p-7 shadow-sm transition-colors duration-300"
          >
            {isLoadingProfile ? (
              <div className="space-y-5 animate-pulse">
                <div className="h-12 w-full rounded-xl bg-[var(--bg-elevated)]" />
                <div className="h-32 w-full rounded-xl bg-[var(--bg-elevated)]" />
                <div className="h-12 w-40 rounded-xl bg-[var(--bg-elevated)]" />
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="profile-username"
                    className="mb-2 block text-sm font-medium text-[var(--text-main)]"
                  >
                    Nombre de usuario
                  </label>
                  <input
                    id="profile-username"
                    type="text"
                    maxLength={MAX_USERNAME_LENGTH}
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Ej. lucia_lectora"
                    className="min-h-[46px] w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25 transition-colors duration-300"
                  />
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                    Así aparecerás en la plataforma.
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label
                      htmlFor="profile-bio"
                      className="block text-sm font-medium text-[var(--text-main)]"
                    >
                      Biografía
                    </label>
                    <span className="text-xs tabular-nums text-[var(--text-muted)]">
                      {bio.length} / {MAX_BIO_LENGTH}
                    </span>
                  </div>
                  <textarea
                    id="profile-bio"
                    rows={4}
                    maxLength={MAX_BIO_LENGTH}
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    placeholder="Cuéntanos brevemente sobre ti, tus temas favoritos o qué te gusta leer…"
                    className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 py-3 text-sm leading-relaxed text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25 transition-colors duration-300"
                  />
                </div>

                {feedback && (
                  <div
                    role={feedback.type === 'error' ? 'alert' : 'status'}
                    className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
                      feedback.type === 'error'
                        ? 'border-red-500/35 bg-red-500/12 text-red-700 dark:text-red-200'
                        : 'border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200'
                    }`}
                  >
                    {feedback.type === 'error' ? (
                      <AlertCircle
                        size={18}
                        className="mt-0.5 shrink-0 text-red-500 dark:text-red-400"
                        aria-hidden="true"
                      />
                    ) : (
                      <CheckCircle2
                        size={18}
                        className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                    )}
                    <span>{feedback.message}</span>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="submit"
                    disabled={
                      isSaving ||
                      isUploadingAvatar ||
                      (!hasUnsavedChanges && profileExists)
                    }
                    className="min-h-[48px] w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-6 py-3 text-sm font-semibold text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-card)]"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                        <span>Guardando…</span>
                      </>
                    ) : (
                      <>
                        <Save size={17} aria-hidden="true" />
                        <span>Guardar cambios</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
