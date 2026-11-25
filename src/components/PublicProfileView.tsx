import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  Heart,
  Mail,
  MessageSquare,
  Newspaper,
  UserRound,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { SeriesRecord } from '../lib/library';
import {
  formatEditorialDate,
  formatRelativeDate,
  type PostAuthor,
  type PostRecord,
} from '../lib/posts';
import {
  fetchFollowCounts,
  fetchPostsByAuthor,
  fetchPublicProfile,
  fetchSeriesByAuthor,
  type FollowCounts,
  type PublicUserProfile,
} from '../lib/social';
import { AchievementsShowcase } from './AchievementsShowcase';
import { Avatar } from './Avatar';
import { FollowButton } from './FollowButton';
import { MediaImage } from './MediaImage';
import { OwnerBadge } from './OwnerBadge';
import { WriterStatsCard } from './WriterStatsCard';

interface PublicProfileViewProps {
  profileUserId: string;
  onBack: () => void;
  onOpenAuth: () => void;
  onOpenOwnProfile: () => void;
  onSelectPost: (post: PostRecord) => void;
  onSelectSeries: (series: SeriesRecord) => void;
  onMessageUser?: (target: PostAuthor) => void;
}

type ProfileTab = 'publicaciones' | 'biblioteca';

export function PublicProfileView({
  profileUserId,
  onBack,
  onOpenAuth,
  onOpenOwnProfile,
  onSelectPost,
  onSelectSeries,
  onMessageUser,
}: PublicProfileViewProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [counts, setCounts] = useState<FollowCounts>({
    followers: 0,
    following: 0,
  });
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesRecord[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('publicaciones');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadUserProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [profileData, countsData, postsData, seriesData] =
        await Promise.all([
          fetchPublicProfile(profileUserId),
          fetchFollowCounts(profileUserId).catch(() => ({
            followers: 0,
            following: 0,
          })),
          fetchPostsByAuthor(profileUserId, user?.id).catch(() => []),
          fetchSeriesByAuthor(profileUserId).catch(() => []),
        ]);

      setProfile(profileData);
      setCounts(countsData);
      setPosts(postsData);
      setSeriesList(seriesData);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el perfil del usuario.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [profileUserId, user?.id]);

  useEffect(() => {
    void loadUserProfile();
  }, [loadUserProfile]);

  const isOwnProfile = Boolean(user && user.id === profileUserId);
  const displayName = profile?.username?.trim() || 'Usuario de Trama';

  return (
    <section className="mx-auto max-w-4xl px-4 py-6 pb-24 sm:px-6 md:px-8 md:py-10 md:pb-20">
      <div className="mb-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] -ml-2 inline-flex items-center gap-2 rounded-xl px-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Volver</span>
        </button>

        {isOwnProfile && (
          <button
            type="button"
            onClick={onOpenOwnProfile}
            className="min-h-[40px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            Editar mi perfil
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-[var(--bg-elevated)]" />
              <div className="space-y-2.5 flex-1">
                <div className="h-6 w-44 rounded bg-[var(--bg-elevated)]" />
                <div className="h-4 w-72 max-w-full rounded bg-[var(--bg-subtle)]" />
              </div>
            </div>
          </div>
          <div className="h-44 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]" />
        </div>
      ) : errorMsg ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-red-500/35 bg-red-500/10 p-5 text-sm text-red-700 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadUserProfile()}
            className="min-h-[40px] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 text-xs font-semibold text-[var(--text-main)]"
          >
            Reintentar
          </button>
        </div>
      ) : !profile ? (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-14 text-center">
          <UserRound
            size={28}
            className="mx-auto text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <h1 className="mt-3 font-display text-xl font-bold text-[var(--text-main)]">
            Perfil no disponible
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            No encontramos información pública para esta cuenta.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tarjeta principal de identidad del autor */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-sm transition-colors duration-300">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center min-w-0">
                <Avatar
                  src={profile.avatar_url}
                  name={displayName}
                  size="lg"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-main)] truncate">
                      {displayName}
                    </h1>
                    <OwnerBadge
                      role={profile.role}
                      badge={profile.badge}
                      size="sm"
                    />
                  </div>

                  {profile.bio ? (
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-line">
                      {profile.bio}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                      Miembro de la comunidad de Trama.
                    </p>
                  )}

                  {profile.created_at && (
                    <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <Calendar size={12} aria-hidden="true" />
                      <span>
                        En Trama desde {formatEditorialDate(profile.created_at)}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {!isOwnProfile && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {onMessageUser && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) {
                          onOpenAuth();
                          return;
                        }
                        onMessageUser({
                          id: profile.id,
                          username: profile.username,
                          avatar_url: profile.avatar_url,
                          role: profile.role,
                          badge: profile.badge,
                        });
                      }}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3.5 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                    >
                      <Mail size={14} aria-hidden="true" />
                      <span>Mensaje</span>
                    </button>
                  )}

                  <FollowButton
                    targetUserId={profile.id}
                    onOpenAuth={onOpenAuth}
                    size="md"
                    onChanged={(nowFollowing) =>
                      setCounts((prev) => ({
                        ...prev,
                        followers: Math.max(
                          0,
                          prev.followers + (nowFollowing ? 1 : -1)
                        ),
                      }))
                    }
                  />
                </div>
              )}
            </div>

            {/* Contadores de Seguidores y Seguidos */}
            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[var(--border-subtle)] pt-5 sm:grid-cols-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3">
                <p className="text-[11px] font-medium text-[var(--text-muted)]">
                  Seguidores
                </p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-[var(--text-main)]">
                  {counts.followers}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3">
                <p className="text-[11px] font-medium text-[var(--text-muted)]">
                  Seguidos
                </p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-[var(--text-main)]">
                  {counts.following}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3">
                <p className="text-[11px] font-medium text-[var(--text-muted)]">
                  Publicaciones
                </p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-[var(--text-main)]">
                  {posts.length}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3">
                <p className="text-[11px] font-medium text-[var(--text-muted)]">
                  Obras
                </p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-[var(--text-main)]">
                  {seriesList.length}
                </p>
              </div>
            </div>
          </div>

          {/* Estadísticas de Escritor y Lectura */}
          <WriterStatsCard userId={profile.id} />

          {/* Vitrina de Logros del usuario */}
          <AchievementsShowcase
            userId={profile.id}
            heading="Vitrina de Logros"
          />

          {/* Pestañas de contenido del autor */}
          <div>
            <div
              role="tablist"
              aria-label="Contenido publicado por el autor"
              className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'publicaciones'}
                onClick={() => setActiveTab('publicaciones')}
                className={`min-h-[42px] inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === 'publicaciones'
                    ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                }`}
              >
                <Newspaper size={15} aria-hidden="true" />
                <span>Publicaciones ({posts.length})</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'biblioteca'}
                onClick={() => setActiveTab('biblioteca')}
                className={`min-h-[42px] inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === 'biblioteca'
                    ? 'border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-main)]'
                }`}
              >
                <BookOpen size={15} aria-hidden="true" />
                <span>Biblioteca ({seriesList.length})</span>
              </button>
            </div>

            {activeTab === 'publicaciones' ? (
              posts.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-12 text-center">
                  <Users
                    size={24}
                    className="mx-auto text-[var(--text-muted)]"
                    aria-hidden="true"
                  />
                  <p className="mt-3 text-sm font-medium text-[var(--text-main)]">
                    Aún no tiene publicaciones
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Cuando publique artículos o hilos aparecerán aquí.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {posts.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => onSelectPost(post)}
                      className="flex flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-left hover:border-[var(--accent-border)] transition-colors duration-300"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-semibold text-[var(--accent-primary)]">
                            {post.mode === 'actualidad'
                              ? 'Actualidad'
                              : 'Comunidad'}{' '}
                            · {post.category}
                          </span>
                          <time
                            dateTime={post.created_at}
                            className="text-[var(--text-muted)] tabular-nums"
                          >
                            {formatRelativeDate(post.created_at)}
                          </time>
                        </div>

                        {post.title && (
                          <h2 className="mt-2 line-clamp-2 font-display text-base font-bold text-[var(--text-main)]">
                            {post.title}
                          </h2>
                        )}

                        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                          {post.content}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center gap-4 border-t border-[var(--border-subtle)] pt-2.5 text-xs text-[var(--text-muted)] tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Heart size={13} aria-hidden="true" />
                          {post.likes_count}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare size={13} aria-hidden="true" />
                          {post.comments_count}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )
            ) : seriesList.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-12 text-center">
                <BookOpen
                  size={24}
                  className="mx-auto text-[var(--text-muted)]"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-medium text-[var(--text-main)]">
                  Aún no tiene obras en Biblioteca
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Las novelas y manhwas publicados por este autor aparecerán aquí.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {seriesList.map((series) => (
                  <button
                    key={series.id}
                    type="button"
                    onClick={() => onSelectSeries(series)}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-left hover:border-[var(--accent-border)] transition-colors duration-300"
                  >
                    <div className="aspect-[3/4] w-full overflow-hidden bg-[var(--bg-subtle)]">
                      {series.cover_url ? (
                        <MediaImage
                          src={series.cover_url}
                          alt={`Portada de ${series.title}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          fallbackClassName="h-full w-full"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[var(--bg-elevated)]">
                          <BookOpen
                            size={24}
                            className="text-[var(--text-muted)]"
                            aria-hidden="true"
                          />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <span className="text-[11px] font-semibold text-[var(--accent-primary)]">
                        {series.type === 'manhwa' ? 'Manhwa' : 'Novela'}
                      </span>
                      <h2 className="mt-0.5 line-clamp-2 font-display text-sm font-bold text-[var(--text-main)] group-hover:text-[var(--accent-primary)] transition-colors">
                        {series.title}
                      </h2>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)] tabular-nums">
                        {series.chapters_count}{' '}
                        {series.chapters_count === 1 ? 'capítulo' : 'capítulos'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
