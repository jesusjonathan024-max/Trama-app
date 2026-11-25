import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ActualidadFeed } from './components/ActualidadFeed';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';
import { ArcadeSection } from './components/ArcadeSection';
import { AuthModal } from './components/AuthModal';
import {
  BibliotecaCatalog,
  type BibliotecaFilter,
} from './components/BibliotecaCatalog';
import { ChapterReaderView } from './components/ChapterReaderView';
import { ComunidadFeed } from './components/ComunidadFeed';
import { CreatePostModal } from './components/CreatePostModal';
import { CreateSeriesModal } from './components/CreateSeriesModal';
import { DirectMessagesModal } from './components/DirectMessagesModal';
import { Navbar, type ActiveView } from './components/Navbar';
import { PostDetailView } from './components/PostDetailView';
import { ProfileSection } from './components/ProfileSection';
import { PublicProfileView } from './components/PublicProfileView';
import { SeriesDetailView } from './components/SeriesDetailView';
import { AchievementProvider } from './context/AchievementContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocialProvider, useSocial } from './context/SocialContext';
import { ThemeProvider } from './context/ThemeContext';
import { ENABLE_AI_FEATURES, type AiChatContext } from './lib/ai';
import {
  fetchChaptersBySeries,
  type ChapterRecord,
  type SeriesRecord,
} from './lib/library';
import { fetchUnreadDirectMessageCount } from './lib/phase4';
import {
  fetchPostById,
  getAuthorDisplayName,
  type PostAuthor,
  type PostMode,
  type PostRecord,
} from './lib/posts';

interface ActiveReaderState {
  series: SeriesRecord;
  chapters: ChapterRecord[];
  chapterIndex: number;
}

function AppShell() {
  const { user, isAuthenticated } = useAuth();
  const { socialError, clearSocialError } = useSocial();

  const [activeView, setActiveView] = useState<ActiveView>('actualidad');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [isCreateSeriesModalOpen, setIsCreateSeriesModalOpen] = useState(false);

  // Estado de Actualidad y Comunidad
  const [actualidadCategory, setActualidadCategory] = useState('Todas');
  const [comunidadCategory, setComunidadCategory] = useState('Todos');
  const [comunidadHashtag, setComunidadHashtag] = useState<string | null>(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(
    null
  );
  const [selectedPost, setSelectedPost] = useState<PostRecord | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null
  );
  const [syncedPostUpdate, setSyncedPostUpdate] = useState<PostRecord | null>(
    null
  );
  const [deletedPostId, setDeletedPostId] = useState<string | null>(null);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  // Estado de Mensajes Directos
  const [isDmModalOpen, setIsDmModalOpen] = useState(false);
  const [dmTargetPartner, setDmTargetPartner] = useState<PostAuthor | null>(
    null
  );
  const [unreadDmCount, setUnreadDmCount] = useState(0);

  // Estado de Biblioteca
  const [bibliotecaFilter, setBibliotecaFilter] =
    useState<BibliotecaFilter>('todas');
  const [bibliotecaSearch, setBibliotecaSearch] = useState('');
  const [selectedSeries, setSelectedSeries] = useState<SeriesRecord | null>(
    null
  );
  const [activeReader, setActiveReader] = useState<ActiveReaderState | null>(
    null
  );
  const [deletedSeriesId, setDeletedSeriesId] = useState<string | null>(null);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);

  // Estado del Asistente IA con búsqueda en vivo
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AiChatContext | null>(null);
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | null>(null);

  const refreshUnreadDms = useCallback(async () => {
    if (!user?.id) {
      setUnreadDmCount(0);
      return;
    }
    try {
      const count = await fetchUnreadDirectMessageCount(user.id);
      setUnreadDmCount(count);
    } catch {
      // Mantiene contador actual
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setUnreadDmCount(0);
      setIsDmModalOpen(false);
      return;
    }
    void refreshUnreadDms();
    const timer = window.setInterval(() => {
      void refreshUnreadDms();
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [user?.id, refreshUnreadDms]);

  const handleOpenMessagesModal = useCallback(
    (partner: PostAuthor | null = null) => {
      if (!isAuthenticated) {
        setIsAuthModalOpen(true);
        return;
      }
      setDmTargetPartner(partner);
      setIsDmModalOpen(true);
    },
    [isAuthenticated]
  );

  const openSectionAssistant = useCallback((section: 'actualidad' | 'comunidad') => {
    if (!ENABLE_AI_FEATURES) return;
    setAiContext({ section });
    setAiInitialPrompt(null);
    setIsAiDrawerOpen(true);
  }, []);

  const openPostAssistant = useCallback(
    (post: PostRecord, initialPrompt?: string) => {
      if (!ENABLE_AI_FEATURES) return;
      setAiContext({
        section: post.mode,
        title: post.title,
        category: post.category,
        author: getAuthorDisplayName(post.author),
        content: post.content,
      });
      setAiInitialPrompt(initialPrompt ?? null);
      setIsAiDrawerOpen(true);
    },
    []
  );

  const handleSelectView = useCallback((view: ActiveView) => {
    setSelectedPost(null);
    setSelectedSeries(null);
    setSelectedProfileId(null);
    setActiveReader(null);
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleOpenAuthorProfile = useCallback(
    (authorId: string) => {
      if (!authorId) return;
      if (user?.id && authorId === user.id) {
        setSelectedPost(null);
        setSelectedSeries(null);
        setSelectedProfileId(null);
        setActiveReader(null);
        setActiveView('perfil');
        window.scrollTo({ top: 0, behavior: 'instant' });
        return;
      }
      setSelectedPost(null);
      setSelectedSeries(null);
      setActiveReader(null);
      setSelectedProfileId(authorId);
      window.scrollTo({ top: 0, behavior: 'instant' });
    },
    [user?.id]
  );

  const handleSelectHashtagFromDetail = useCallback((tag: string) => {
    setSelectedPost(null);
    setSelectedSeries(null);
    setSelectedProfileId(null);
    setActiveView('comunidad');
    setComunidadCategory('Todos');
    setComunidadHashtag(tag);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleOpenGlobalCreate = useCallback(() => {
    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }
    setIsCreatePostModalOpen(true);
  }, [isAuthenticated]);

  const handleOpenNotificationPost = useCallback(
    async (postId: string) => {
      try {
        const post = await fetchPostById(postId, user?.id);
        if (!post) return;
        setSelectedSeries(null);
        setSelectedProfileId(null);
        setActiveReader(null);
        setActiveView(post.mode);
        setSelectedPost(post);
        window.scrollTo({ top: 0, behavior: 'instant' });
      } catch {
        // Ignora si la publicación ya fue eliminada
      }
    },
    [user?.id]
  );

  const handleSelectPost = useCallback((post: PostRecord) => {
    setSelectedProfileId(null);
    setSelectedPost(post);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handlePostUpdated = useCallback((updated: PostRecord) => {
    setSyncedPostUpdate(updated);
    setSelectedPost((prev) =>
      prev && prev.id === updated.id ? updated : prev
    );
  }, []);

  const handlePostDeleted = useCallback((postId: string) => {
    setDeletedPostId(postId);
    setSelectedPost(null);
  }, []);

  const handlePostCreated = useCallback((publishedMode: PostMode) => {
    setSelectedPost(null);
    setSelectedSeries(null);
    setSelectedProfileId(null);
    setActiveReader(null);
    setActiveView(publishedMode);
    if (publishedMode === 'actualidad') {
      setActualidadCategory('Todas');
    } else {
      setComunidadCategory('Todos');
      setComunidadHashtag(null);
    }
    setFeedRefreshKey((prev) => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectSeries = useCallback((series: SeriesRecord) => {
    setSelectedProfileId(null);
    setSelectedSeries(series);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleOpenChapter = useCallback(
    (
      series: SeriesRecord,
      chaptersAscending: ChapterRecord[],
      chapterIndex: number
    ) => {
      setActiveReader({
        series,
        chapters: chaptersAscending,
        chapterIndex,
      });
    },
    []
  );

  const handleResumeChapterFromHistory = useCallback(
    async (series: SeriesRecord, chapterId: string | null) => {
      try {
        const chapters = await fetchChaptersBySeries(series.id);
        if (chapters.length === 0) {
          setSelectedProfileId(null);
          setSelectedSeries(series);
          window.scrollTo({ top: 0, behavior: 'instant' });
          return;
        }
        const targetIndex = chapterId
          ? chapters.findIndex((c) => c.id === chapterId)
          : 0;
        setSelectedProfileId(null);
        setSelectedSeries(series);
        setActiveReader({
          series,
          chapters,
          chapterIndex: targetIndex >= 0 ? targetIndex : 0,
        });
        window.scrollTo({ top: 0, behavior: 'instant' });
      } catch {
        setSelectedProfileId(null);
        setSelectedSeries(series);
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    },
    []
  );

  const handleSeriesCreated = useCallback((created: SeriesRecord) => {
    setBibliotecaFilter('todas');
    setBibliotecaSearch('');
    setLibraryRefreshKey((prev) => prev + 1);
    setSelectedSeries(created);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSeriesDeleted = useCallback((seriesId: string) => {
    setDeletedSeriesId(seriesId);
    setSelectedSeries(null);
    setActiveReader(null);
  }, []);

  // Lector a pantalla completa (Novela o Manhwa)
  if (activeReader) {
    return (
      <>
        <ChapterReaderView
          series={activeReader.series}
          chapters={activeReader.chapters}
          chapterIndex={activeReader.chapterIndex}
          onChangeChapterIndex={(nextIdx) =>
            setActiveReader((prev) =>
              prev ? { ...prev, chapterIndex: nextIdx } : null
            )
          }
          onBackToSeries={() => {
            setActiveReader(null);
            window.scrollTo({ top: 0, behavior: 'instant' });
          }}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      </>
    );
  }

  const defaultCreatePostMode: PostMode =
    activeView === 'comunidad' ? 'comunidad' : 'actualidad';

  const showFloatingCreatePostButton =
    isAuthenticated &&
    !selectedPost &&
    !selectedSeries &&
    !selectedProfileId &&
    !isCreatePostModalOpen &&
    !isCreateSeriesModalOpen &&
    (activeView === 'actualidad' || activeView === 'comunidad');

  return (
    <div className="min-h-dvh bg-[var(--bg-base)] text-[var(--text-main)] flex flex-col transition-colors duration-300">
      <Navbar
        activeView={activeView}
        onSelectView={handleSelectView}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenCreate={handleOpenGlobalCreate}
        onOpenNotificationPost={(postId) => void handleOpenNotificationPost(postId)}
        onOpenNotificationProfile={handleOpenAuthorProfile}
        unreadDmCount={unreadDmCount}
        onOpenMessages={() => handleOpenMessagesModal(null)}
      />

      {socialError && (
        <div
          role="alert"
          className="mx-auto mt-3 flex w-full max-w-4xl items-center justify-between gap-3 px-4 sm:px-6"
        >
          <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/12 px-4 py-2.5 text-xs text-red-700 dark:text-red-100">
            <span>{socialError}</span>
            <button
              type="button"
              onClick={clearSocialError}
              className="shrink-0 rounded-lg px-2 py-1 font-semibold hover:bg-red-500/15"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {selectedPost ? (
          <PostDetailView
            initialPost={selectedPost}
            onBack={() => setSelectedPost(null)}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenAuthorProfile={handleOpenAuthorProfile}
            onSelectHashtag={handleSelectHashtagFromDetail}
            onPostUpdated={handlePostUpdated}
            onPostDeleted={handlePostDeleted}
            onOpenAssistant={openPostAssistant}
          />
        ) : selectedSeries ? (
          <SeriesDetailView
            initialSeries={selectedSeries}
            onBack={() => setSelectedSeries(null)}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenAuthorProfile={handleOpenAuthorProfile}
            onOpenChapter={handleOpenChapter}
            onSeriesDeleted={handleSeriesDeleted}
            onSeriesChanged={() => setLibraryRefreshKey((prev) => prev + 1)}
          />
        ) : selectedProfileId ? (
          <PublicProfileView
            profileUserId={selectedProfileId}
            onBack={() => setSelectedProfileId(null)}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenOwnProfile={() => handleSelectView('perfil')}
            onSelectPost={handleSelectPost}
            onSelectSeries={handleSelectSeries}
            onMessageUser={(target) => handleOpenMessagesModal(target)}
          />
        ) : activeView === 'perfil' ? (
          <ProfileSection
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onSignedOut={() => handleSelectView('actualidad')}
            onOpenPost={handleSelectPost}
            onOpenSeries={handleSelectSeries}
            onResumeChapter={(series, chapterId) =>
              void handleResumeChapterFromHistory(series, chapterId)
            }
            onPostDeleted={handlePostDeleted}
          />
        ) : activeView === 'actualidad' ? (
          <ActualidadFeed
            selectedCategory={actualidadCategory}
            onSelectCategory={setActualidadCategory}
            refreshKey={feedRefreshKey}
            syncedPostUpdate={syncedPostUpdate}
            deletedPostId={deletedPostId}
            onSelectPost={handleSelectPost}
            onOpenAuthorProfile={handleOpenAuthorProfile}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenCreate={() => setIsCreatePostModalOpen(true)}
            onOpenAssistant={() => openSectionAssistant('actualidad')}
          />
        ) : activeView === 'comunidad' ? (
          <ComunidadFeed
            selectedCategory={comunidadCategory}
            onSelectCategory={setComunidadCategory}
            selectedHashtag={comunidadHashtag}
            onSelectHashtag={setComunidadHashtag}
            selectedCommunityId={selectedCommunityId}
            onSelectCommunityId={setSelectedCommunityId}
            refreshKey={feedRefreshKey}
            syncedPostUpdate={syncedPostUpdate}
            deletedPostId={deletedPostId}
            onSelectPost={handleSelectPost}
            onOpenAuthorProfile={handleOpenAuthorProfile}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenCreate={() => setIsCreatePostModalOpen(true)}
            onOpenAssistant={() => openSectionAssistant('comunidad')}
          />
        ) : activeView === 'arcade' ? (
          <ArcadeSection onOpenAuth={() => setIsAuthModalOpen(true)} />
        ) : (
          <BibliotecaCatalog
            selectedFilter={bibliotecaFilter}
            onSelectFilter={setBibliotecaFilter}
            searchQuery={bibliotecaSearch}
            onSearchQueryChange={setBibliotecaSearch}
            refreshKey={libraryRefreshKey}
            deletedSeriesId={deletedSeriesId}
            onSelectSeries={handleSelectSeries}
            onOpenAuthorProfile={handleOpenAuthorProfile}
            onOpenCreateSeries={() => setIsCreateSeriesModalOpen(true)}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}
      </main>

      {/* Botón flotante "+" ubicado abajo a la izquierda para no cruzarse nunca con el sello inferior derecho de Netlify */}
      {showFloatingCreatePostButton && (
        <button
          type="button"
          onClick={() => setIsCreatePostModalOpen(true)}
          aria-label="Crear publicación"
          title="Crear publicación"
          className="fixed bottom-5 left-4 z-30 flex h-13 w-13 items-center justify-center rounded-2xl bg-[var(--accent-primary)] text-[var(--accent-fg)] shadow-lg hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-300 md:bottom-6 md:left-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]"
        >
          <Plus size={24} strokeWidth={2.4} aria-hidden="true" />
        </button>
      )}

      <CreatePostModal
        isOpen={isCreatePostModalOpen}
        defaultMode={defaultCreatePostMode}
        defaultCommunityId={
          defaultCreatePostMode === 'comunidad' ? selectedCommunityId : null
        }
        onClose={() => setIsCreatePostModalOpen(false)}
        onCreated={handlePostCreated}
      />

      <CreateSeriesModal
        isOpen={isCreateSeriesModalOpen}
        onClose={() => setIsCreateSeriesModalOpen(false)}
        onCreated={handleSeriesCreated}
      />

      <DirectMessagesModal
        isOpen={isDmModalOpen}
        initialPartner={dmTargetPartner}
        onClose={() => {
          setIsDmModalOpen(false);
          void refreshUnreadDms();
        }}
        onOpenProfile={handleOpenAuthorProfile}
        onUnreadChanged={() => void refreshUnreadDms()}
      />

      {ENABLE_AI_FEATURES && (
        <AiAssistantDrawer
          isOpen={isAiDrawerOpen}
          onClose={() => setIsAiDrawerOpen(false)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          context={aiContext}
          initialPrompt={aiInitialPrompt}
          onClearInitialPrompt={() => setAiInitialPrompt(null)}
        />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SocialProvider>
          <AchievementProvider>
            <AppShell />
          </AchievementProvider>
        </SocialProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
