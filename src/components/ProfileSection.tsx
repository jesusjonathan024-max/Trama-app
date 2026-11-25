import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  AlertCircle,
  Award,
  Bookmark,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  FileText,
  Flag,
  Heart,
  Loader2,
  LogOut,
  MessageSquare,
  Palette,
  Play,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAchievements } from '../context/AchievementContext';
import { useAuth } from '../context/AuthContext';
import { useSocial } from '../context/SocialContext';
import { useTheme } from '../context/ThemeContext';
import { fetchSeriesCatalog, type SeriesRecord } from '../lib/library';
import {
  fetchContentReports,
  formatReportStatusLabel,
  isReportPendingStatus,
  updateContentReportStatus,
  type ContentReportRecord,
} from '../lib/phase2';
import {
  clearReadingHistory,
  fetchReadingHistory,
  type ReadingHistoryItem,
} from '../lib/phase3';
import {
  deletePost,
  fetchAllMembers,
  fetchOwnerStats,
  formatRelativeDate,
  getAuthorDisplayName,
  updateMemberBadge,
  type MemberDirectoryItem,
  type OwnerPlatformStats,
  type PostRecord,
} from '../lib/posts';
import {
  fetchPostsByIds,
  READING_STATUS_OPTIONS,
  type ReadingStatus,
} from '../lib/social';
import {
  MEDIA_BUCKET,
  MEMBER_BADGE_OPTIONS,
  isSafeHttpUrl,
  supabase,
} from '../lib/supabase';
import { AchievementsShowcase } from './AchievementsShowcase';
import { AppearanceControls } from './AppearanceControls';
import { Avatar } from './Avatar';
import { MediaImage } from './MediaImage';
import { OwnerBadge } from './OwnerBadge';
import { OwnerGameModerationPanel } from './OwnerGameModerationPanel';
import { WriterStatsCard } from './WriterStatsCard';

interface ProfileSectionProps {
  onOpenAuth: () => void;
  onSignedOut: () => void;
  onOpenPost: (post: PostRecord) => void;
  onOpenSeries: (series: SeriesRecord) => void;
  onResumeChapter?: (series: SeriesRecord, chapterId: string | null) => void;
  onPostDeleted?: (postId: string) => void;
}

type CollectionTab =
  | 'guardados'
  | 'favoritos'
  | 'pendiente'
  | 'leyendo'
  | 'terminado'
  | 'historial';

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
  onOpenPost,
  onOpenSeries,
  onResumeChapter,
  onPostDeleted,
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
  const { unlockedMap } = useAchievements();
  const {
    myFollowCounts,
    savedPostIds,
    seriesCollections,
    toggleSavePost,
    setSeriesStatus,
    toggleSeriesFavorite,
    refreshSocial,
  } = useSocial();

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const [collectionTab, setCollectionTab] =
    useState<CollectionTab>('guardados');
  const [savedPosts, setSavedPosts] = useState<PostRecord[]>([]);
  const [catalogSeries, setCatalogSeries] = useState<SeriesRecord[]>([]);
  const [readingHistory, setReadingHistory] = useState<ReadingHistoryItem[]>(
    []
  );
  const [isLoadingCollection, setIsLoadingCollection] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [ownerStats, setOwnerStats] = useState<OwnerPlatformStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [members, setMembers] = useState<MemberDirectoryItem[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [savedMemberId, setSavedMemberId] = useState<string | null>(null);

  // Bandeja de reportes de contenido (solo Dueño)
  const [reports, setReports] = useState<ContentReportRecord[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportsFilter, setReportsFilter] = useState<'pending' | 'all'>('pending');
  const [processingReportId, setProcessingReportId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const savedIdsKey = useMemo(() => savedPostIds.join(','), [savedPostIds]);

  const loadCollectionItems = useCallback(async () => {
    if (!user?.id) {
      setSavedPosts([]);
      setCatalogSeries([]);
      setReadingHistory([]);
      return;
    }
    setIsLoadingCollection(true);
    setHistoryError(null);
    try {
      const [postsData, seriesData, historyData] = await Promise.all([
        savedPostIds.length > 0
          ? fetchPostsByIds(savedPostIds, user.id)
          : Promise.resolve([]),
        fetchSeriesCatalog().catch(() => []),
        fetchReadingHistory(user.id).catch(() => []),
      ]);
      setSavedPosts(postsData);
      setCatalogSeries(seriesData);
      setReadingHistory(historyData);
    } finally {
      setIsLoadingCollection(false);
    }
  }, [user?.id, savedIdsKey, savedPostIds]);

  async function handleClearHistory() {
    if (!user?.id || isClearingHistory) return;
    setIsClearingHistory(true);
    setHistoryError(null);
    try {
      await clearReadingHistory(user.id);
      setReadingHistory([]);
      setConfirmClearHistory(false);
    } catch (err) {
      setHistoryError(
        err instanceof Error
          ? err.message
          : 'No se pudo limpiar el historial de lectura.'
      );
    } finally {
      setIsClearingHistory(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    void loadCollectionItems();
  }, [isAuthenticated, user?.id, loadCollectionItems]);

  const seriesById = useMemo(
    () => new Map(catalogSeries.map((s) => [s.id, s])),
    [catalogSeries]
  );

  const favoriteSeriesList = useMemo(
    () =>
      Object.values(seriesCollections)
        .filter((entry) => entry.is_favorite)
        .map((entry) => seriesById.get(entry.series_id))
        .filter((s): s is SeriesRecord => Boolean(s)),
    [seriesCollections, seriesById]
  );

  const pendingSeriesList = useMemo(
    () =>
      Object.values(seriesCollections)
        .filter((entry) => entry.status === 'pendiente')
        .map((entry) => seriesById.get(entry.series_id))
        .filter((s): s is SeriesRecord => Boolean(s)),
    [seriesCollections, seriesById]
  );

  const readingSeriesList = useMemo(
    () =>
      Object.values(seriesCollections)
        .filter((entry) => entry.status === 'leyendo')
        .map((entry) => seriesById.get(entry.series_id))
        .filter((s): s is SeriesRecord => Boolean(s)),
    [seriesCollections, seriesById]
  );

  const completedSeriesList = useMemo(
    () =>
      Object.values(seriesCollections)
        .filter((entry) => entry.status === 'terminado')
        .map((entry) => seriesById.get(entry.series_id))
        .filter((s): s is SeriesRecord => Boolean(s)),
    [seriesCollections, seriesById]
  );

  useEffect(() => {
    setUsername(profile?.username ?? '');
    setBio(profile?.bio ?? '');
    setAvatarUrl(profile?.avatar_url ?? null);
  }, [profile]);

  const loadOwnerPanelData = useCallback(async () => {
    if (!isOwner) return;
    setIsLoadingStats(true);
    setIsLoadingMembers(true);
    setIsLoadingReports(true);
    setStatsError(null);
    setMembersError(null);
    setReportsError(null);

    const [statsRes, membersRes, reportsRes] = await Promise.allSettled([
      fetchOwnerStats(),
      fetchAllMembers(),
      fetchContentReports(),
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

    if (reportsRes.status === 'fulfilled') {
      setReports(reportsRes.value);
    } else {
      setReportsError(
        reportsRes.reason instanceof Error
          ? reportsRes.reason.message
          : 'No se pudieron cargar los reportes pendientes.'
      );
    }
    setIsLoadingReports(false);
  }, [isOwner]);

  useEffect(() => {
    if (!isOwner) {
      setOwnerStats(null);
      setMembers([]);
      setReports([]);
      return;
    }
    void loadOwnerPanelData();
  }, [isOwner, loadOwnerPanelData]);

  async function handleUpdateReportStatus(
    reportId: string,
    nextStatus: 'reviewed' | 'dismissed'
  ) {
    if (!isOwner || processingReportId) return;
    setProcessingReportId(reportId);
    setReportsError(null);
    try {
      const savedStatus = await updateContentReportStatus(reportId, nextStatus);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: savedStatus } : r))
      );
    } catch (err) {
      setReportsError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar el estado del reporte.'
      );
    } finally {
      setProcessingReportId(null);
    }
  }

  async function handleDeleteReportedPost(report: ContentReportRecord) {
    if (!isOwner || !user || processingReportId) return;
    setProcessingReportId(report.id);
    setReportsError(null);
    try {
      await deletePost(report.post_id, user.id, true);
      onPostDeleted?.(report.post_id);
      const savedStatus = await updateContentReportStatus(
        report.id,
        'reviewed'
      ).catch(() => 'reviewed');
      setReports((prev) =>
        prev.map((r) =>
          r.post_id === report.post_id
            ? { ...r, status: savedStatus, post: null }
            : r
        )
      );
    } catch (err) {
      setReportsError(
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar la publicación reportada.'
      );
    } finally {
      setProcessingReportId(null);
    }
  }

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

      {/* Estadísticas de Escritor del usuario */}
      <div className="mt-7">
        <WriterStatsCard
          userId={user.id}
          heading="Mis Estadísticas de Escritor"
        />
      </div>

      {/* Vitrina de Logros del usuario */}
      <div className="mt-7">
        <AchievementsShowcase
          userId={user.id}
          heading="Mi Vitrina de Logros"
          preloadedMap={unlockedMap}
        />
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

      {/* Mi Colección y Lecturas (Guardados, Favoritos, Pendiente, Leyendo, Terminados) */}
      <div
        aria-labelledby="collections-heading"
        className="mt-7 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-sm transition-colors duration-300"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Bookmark size={18} aria-hidden="true" />
            </div>
            <div>
              <h2
                id="collections-heading"
                className="font-display text-lg font-bold tracking-tight text-[var(--text-main)]"
              >
                Mi Colección y Lecturas
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Publicaciones guardadas, obras favoritas y listas organizadas de Biblioteca.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void refreshSocial();
              void loadCollectionItems();
            }}
            disabled={isLoadingCollection}
            aria-label="Actualizar colección"
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 text-xs font-medium text-[var(--text-main)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              size={13}
              className={isLoadingCollection ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Pestañas de colección */}
        <div
          role="tablist"
          aria-label="Listas de guardados y lectura"
          className="no-scrollbar mt-4 flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border-subtle)] pb-3"
        >
          {(
            [
              {
                id: 'guardados',
                label: 'Guardados',
                count: savedPostIds.length,
              },
              {
                id: 'favoritos',
                label: 'Favoritos',
                count: favoriteSeriesList.length,
              },
              {
                id: 'pendiente',
                label: 'Pendiente',
                count: pendingSeriesList.length,
              },
              {
                id: 'leyendo',
                label: 'Leyendo',
                count: readingSeriesList.length,
              },
              {
                id: 'terminado',
                label: 'Terminados',
                count: completedSeriesList.length,
              },
              {
                id: 'historial',
                label: 'Historial',
                count: readingHistory.length,
              },
            ] as const
          ).map((tab) => {
            const isActive = collectionTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setCollectionTab(tab.id);
                  setConfirmClearHistory(false);
                }}
                className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${
                    isActive
                      ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Contenido de la pestaña activa */}
        <div className="mt-4">
          {isLoadingCollection &&
          savedPosts.length === 0 &&
          catalogSeries.length === 0 &&
          readingHistory.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--text-muted)]">
              <Loader2
                size={15}
                className="animate-spin text-[var(--accent-primary)]"
                aria-hidden="true"
              />
              <span>Cargando tu colección…</span>
            </div>
          ) : collectionTab === 'historial' ? (
            <div className="space-y-3">
              {readingHistory.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    Retoma tus artículos de Actualidad o capítulos de Biblioteca donde los dejaste.
                  </p>
                  {confirmClearHistory ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        ¿Borrar historial?
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleClearHistory()}
                        disabled={isClearingHistory}
                        className="min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                      >
                        {isClearingHistory ? (
                          <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 size={12} aria-hidden="true" />
                        )}
                        <span>Confirmar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearHistory(false)}
                        disabled={isClearingHistory}
                        className="min-h-[34px] rounded-lg border border-[var(--border-subtle)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearHistory(true)}
                      className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:border-red-500/35 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      <span>Limpiar historial</span>
                    </button>
                  )}
                </div>
              )}

              {historyError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-200"
                >
                  <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
                  <span>{historyError}</span>
                </div>
              )}

              {readingHistory.length === 0 ? (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-8 text-center">
                  <Clock
                    size={20}
                    className="mx-auto text-[var(--text-muted)]"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-sm font-medium text-[var(--text-main)]">
                    Tu historial de lectura está vacío
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Cuando abras un artículo en Actualidad o un capítulo en Biblioteca, aparecerá aquí para retomarlo con un toque.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {readingHistory.map((item) => {
                    if (item.kind === 'post' && item.post) {
                      const post = item.post;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onOpenPost(post)}
                          className="group flex items-start justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3.5 text-left transition-colors hover:border-[var(--accent-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="font-semibold text-[var(--accent-primary)]">
                                {post.mode === 'actualidad'
                                  ? 'Actualidad'
                                  : 'Comunidad'}{' '}
                                · {post.category}
                              </span>
                              <span
                                aria-hidden="true"
                                className="text-[var(--text-muted)]"
                              >
                                ·
                              </span>
                              <span className="text-[var(--text-muted)] tabular-nums">
                                Leído {formatRelativeDate(item.last_read_at)}
                              </span>
                            </div>
                            <h3 className="mt-1 line-clamp-2 font-display text-sm font-bold text-[var(--text-main)] group-hover:text-[var(--accent-primary)] transition-colors">
                              {post.title || post.content.slice(0, 80)}
                            </h3>
                            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                              Por {getAuthorDisplayName(post.author)}
                            </p>
                          </div>

                          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-primary)]">
                            <Play size={11} aria-hidden="true" />
                            <span>Leer</span>
                          </span>
                        </button>
                      );
                    }

                    if (item.kind === 'chapter' && item.series) {
                      const series = item.series;
                      const chapterLabel = item.chapter
                        ? `Cap. ${item.chapter.chapter_number}${
                            item.chapter.title ? ` · ${item.chapter.title}` : ''
                          }`
                        : 'Último capítulo leído';
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            onResumeChapter
                              ? onResumeChapter(series, item.chapter_id)
                              : onOpenSeries(series)
                          }
                          className="group flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3 text-left transition-colors hover:border-[var(--accent-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                        >
                          <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                            {series.cover_url ? (
                              <MediaImage
                                src={series.cover_url}
                                alt={`Portada de ${series.title}`}
                                className="h-full w-full object-cover"
                                fallbackClassName="h-full w-full"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <BookOpen
                                  size={16}
                                  className="text-[var(--text-muted)]"
                                  aria-hidden="true"
                                />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="font-semibold text-[var(--accent-primary)]">
                                {series.type === 'manhwa' ? 'Manhwa' : 'Novela'}
                              </span>
                              <span
                                aria-hidden="true"
                                className="text-[var(--text-muted)]"
                              >
                                ·
                              </span>
                              <span className="truncate text-[var(--text-muted)] tabular-nums">
                                {formatRelativeDate(item.last_read_at)}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate font-display text-sm font-bold text-[var(--text-main)] group-hover:text-[var(--accent-primary)] transition-colors">
                              {series.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                              {chapterLabel}
                            </p>
                          </div>

                          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--accent-primary)]">
                            <Play size={11} aria-hidden="true" />
                            <span>Retomar</span>
                          </span>
                        </button>
                      );
                    }

                    return null;
                  })}
                </div>
              )}
            </div>
          ) : collectionTab === 'guardados' ? (
            savedPosts.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-8 text-center">
                <Bookmark
                  size={20}
                  className="mx-auto text-[var(--text-muted)]"
                  aria-hidden="true"
                />
                <p className="mt-2 text-sm font-medium text-[var(--text-main)]">
                  Aún no tienes publicaciones guardadas
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Usa el botón Guardar en cualquier artículo de Actualidad o hilo de Comunidad.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {savedPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3.5 transition-colors hover:border-[var(--accent-border)]"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenPost(post)}
                      className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded"
                    >
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="font-semibold text-[var(--accent-primary)]">
                          {post.mode === 'actualidad'
                            ? 'Actualidad'
                            : 'Comunidad'}{' '}
                          · {post.category}
                        </span>
                        <span aria-hidden="true" className="text-[var(--text-muted)]">
                          ·
                        </span>
                        <span className="text-[var(--text-muted)] tabular-nums">
                          {formatRelativeDate(post.created_at)}
                        </span>
                      </div>
                      <h3 className="mt-1 line-clamp-2 font-display text-sm font-bold text-[var(--text-main)] hover:text-[var(--accent-primary)] transition-colors">
                        {post.title || post.content.slice(0, 80)}
                      </h3>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        Por {getAuthorDisplayName(post.author)}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => void toggleSavePost(post.id)}
                      title="Quitar de guardados"
                      aria-label="Quitar de guardados"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-red-500 transition-colors"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (() => {
            const list =
              collectionTab === 'favoritos'
                ? favoriteSeriesList
                : collectionTab === 'pendiente'
                  ? pendingSeriesList
                  : collectionTab === 'leyendo'
                    ? readingSeriesList
                    : completedSeriesList;

            if (list.length === 0) {
              return (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-8 text-center">
                  <BookOpen
                    size={20}
                    className="mx-auto text-[var(--text-muted)]"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-sm font-medium text-[var(--text-main)]">
                    No hay obras en esta lista todavía
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Elige el estado de lectura o marca como favorita cualquier novela o manhwa en Biblioteca.
                  </p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {list.map((series) => {
                  const entry = seriesCollections[series.id];
                  const isFav = Boolean(entry?.is_favorite);
                  return (
                    <div
                      key={series.id}
                      className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3 transition-colors hover:border-[var(--accent-border)]"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenSeries(series)}
                        className="h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]"
                      >
                        {series.cover_url ? (
                          <MediaImage
                            src={series.cover_url}
                            alt={`Portada de ${series.title}`}
                            className="h-full w-full object-cover"
                            fallbackClassName="h-full w-full"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <BookOpen
                              size={16}
                              className="text-[var(--text-muted)]"
                              aria-hidden="true"
                            />
                          </div>
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onOpenSeries(series)}
                          className="block w-full text-left"
                        >
                          <p className="truncate font-display text-sm font-bold text-[var(--text-main)] hover:text-[var(--accent-primary)] transition-colors">
                            {series.title}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)]">
                            {series.type === 'manhwa' ? 'Manhwa' : 'Novela'} ·{' '}
                            {series.chapters_count}{' '}
                            {series.chapters_count === 1 ? 'cap.' : 'caps.'}
                          </p>
                        </button>

                        <div className="mt-2 flex items-center gap-2">
                          <select
                            aria-label={`Cambiar estado de ${series.title}`}
                            value={entry?.status ?? ''}
                            onChange={(e) =>
                              void setSeriesStatus(
                                series.id,
                                e.target.value
                                  ? (e.target.value as ReadingStatus)
                                  : null
                              )
                            }
                            className="h-7 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 text-[11px] font-medium text-[var(--text-main)] focus:border-[var(--accent-primary)] focus:outline-none"
                          >
                            <option value="">Sin estado</option>
                            {READING_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => void toggleSeriesFavorite(series.id)}
                            aria-pressed={isFav}
                            title={
                              isFav
                                ? 'Quitar de favoritos'
                                : 'Marcar como favorita'
                            }
                            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors ${
                              isFav
                                ? 'border-rose-500/40 bg-rose-500/12 text-rose-500'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-rose-500'
                            }`}
                          >
                            <Heart
                              size={12}
                              className={isFav ? 'fill-current' : ''}
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
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

          {/* Reportes Pendientes de Contenido (solo Dueño) */}
          <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
            {(() => {
              const pendingCount = reports.filter((r) =>
                isReportPendingStatus(r.status)
              ).length;
              const visibleReports =
                reportsFilter === 'pending'
                  ? reports.filter((r) => isReportPendingStatus(r.status))
                  : reports;

              return (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Flag
                        size={17}
                        className="text-rose-400 shrink-0"
                        aria-hidden="true"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-display text-base font-bold text-[var(--text-main)]">
                            Reportes Pendientes
                          </h3>
                          {pendingCount > 0 && (
                            <span className="rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[11px] font-bold text-rose-400 tabular-nums">
                              {pendingCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">
                          Revisa alertas de noticias falsas o contenido reportado por la comunidad.
                        </p>
                      </div>
                    </div>

                    <div className="inline-flex rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setReportsFilter('pending')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          reportsFilter === 'pending'
                            ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-xs'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        Pendientes ({pendingCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportsFilter('all')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          reportsFilter === 'all'
                            ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-xs'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        Todos ({reports.length})
                      </button>
                    </div>
                  </div>

                  {reportsError && (
                    <div
                      role="alert"
                      className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-200"
                    >
                      <AlertCircle
                        size={15}
                        className="mt-0.5 shrink-0 text-red-500 dark:text-red-400"
                        aria-hidden="true"
                      />
                      <span>{reportsError}</span>
                    </div>
                  )}

                  <div className="mt-4 max-h-[380px] space-y-2.5 overflow-y-auto pr-1">
                    {isLoadingReports && reports.length === 0 ? (
                      <div className="space-y-2 animate-pulse">
                        <div className="h-20 rounded-xl bg-[var(--bg-subtle)]" />
                        <div className="h-20 rounded-xl bg-[var(--bg-subtle)]" />
                      </div>
                    ) : visibleReports.length === 0 ? (
                      <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-6 text-center text-xs text-[var(--text-muted)]">
                        {reportsFilter === 'pending'
                          ? 'No hay reportes pendientes por revisar.'
                          : 'Todavía no se han registrado reportes.'}
                      </p>
                    ) : (
                      visibleReports.map((report) => {
                        const isPending = isReportPendingStatus(report.status);
                        const isBusy = processingReportId === report.id;
                        const reporterName = getAuthorDisplayName(
                          report.reporter
                        );

                        return (
                          <div
                            key={report.id}
                            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3.5 space-y-2.5 transition-colors"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                                    isPending
                                      ? 'border-rose-500/35 bg-rose-500/12 text-rose-400'
                                      : 'border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-muted)]'
                                  }`}
                                >
                                  {formatReportStatusLabel(report.status)}
                                </span>
                                <span className="text-[var(--text-secondary)]">
                                  Reportado por{' '}
                                  <strong className="text-[var(--text-main)]">
                                    {reporterName}
                                  </strong>
                                </span>
                              </div>
                              <time
                                dateTime={report.created_at}
                                className="text-[11px] text-[var(--text-muted)] tabular-nums"
                              >
                                {formatRelativeDate(report.created_at)}
                              </time>
                            </div>

                            <p className="text-xs text-[var(--text-main)]">
                              <span className="text-[var(--text-muted)]">
                                Motivo:{' '}
                              </span>
                              {report.reason}
                            </p>

                            {report.post ? (
                              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-xs">
                                <p className="text-[10px] font-semibold text-[var(--accent-primary)]">
                                  {report.post.mode === 'actualidad'
                                    ? 'Actualidad'
                                    : 'Comunidad'}{' '}
                                  · {report.post.category}
                                </p>
                                <p className="mt-0.5 font-semibold text-[var(--text-main)] line-clamp-1">
                                  {report.post.title ||
                                    report.post.content.slice(0, 90)}
                                </p>
                              </div>
                            ) : (
                              <p className="text-[11px] italic text-[var(--text-muted)]">
                                La publicación asociada ya fue eliminada.
                              </p>
                            )}

                            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void handleUpdateReportStatus(
                                        report.id,
                                        'reviewed'
                                      )
                                    }
                                    className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                                  >
                                    <Check size={13} aria-hidden="true" />
                                    <span>Marcar revisado</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      void handleUpdateReportStatus(
                                        report.id,
                                        'dismissed'
                                      )
                                    }
                                    className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] disabled:opacity-50 transition-colors"
                                  >
                                    <X size={13} aria-hidden="true" />
                                    <span>Descartar</span>
                                  </button>
                                </>
                              )}

                              {report.post && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    void handleDeleteReportedPost(report)
                                  }
                                  className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-red-600/90 hover:bg-red-500 px-3 text-xs font-semibold text-white disabled:opacity-50 transition-colors"
                                >
                                  {isBusy ? (
                                    <Loader2
                                      size={13}
                                      className="animate-spin"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Trash2 size={13} aria-hidden="true" />
                                  )}
                                  <span>Eliminar publicación</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          {/* Moderación de Juegos enviados por la comunidad (Sandbox aislado) */}
          <OwnerGameModerationPanel />
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

              {/* Contadores de Seguidores y Seguidos */}
              <div className="mt-4 grid w-full grid-cols-2 gap-2.5 border-y border-[var(--border-subtle)] py-3">
                <div className="rounded-xl bg-[var(--bg-subtle)] px-3 py-2 text-center">
                  <p className="font-display text-lg font-bold tabular-nums text-[var(--text-main)]">
                    {myFollowCounts.followers}
                  </p>
                  <p className="text-[11px] font-medium text-[var(--text-muted)]">
                    Seguidores
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--bg-subtle)] px-3 py-2 text-center">
                  <p className="font-display text-lg font-bold tabular-nums text-[var(--text-main)]">
                    {myFollowCounts.following}
                  </p>
                  <p className="text-[11px] font-medium text-[var(--text-muted)]">
                    Seguidos
                  </p>
                </div>
              </div>

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
