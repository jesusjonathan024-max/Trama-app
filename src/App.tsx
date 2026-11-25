import { useCallback, useState } from 'react';
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
import { Navbar, type ActiveView } from './components/Navbar';
import { PostDetailView } from './components/PostDetailView';
import { ProfileSection } from './components/ProfileSection';
import { SeriesDetailView } from './components/SeriesDetailView';
import { AuthProvider, useAuth } from './context/AuthContext';
import type { AiChatContext } from './lib/ai';
import type { ChapterRecord, SeriesRecord } from './lib/library';
import { getAuthorDisplayName, type PostMode, type PostRecord } from './lib/posts';

interface ActiveReaderState {
  series: SeriesRecord;
  chapters: ChapterRecord[];
  chapterIndex: number;
}

function AppShell() {
  const { isAuthenticated } = useAuth();

  const [activeView, setActiveView] = useState<ActiveView>('actualidad');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [isCreateSeriesModalOpen, setIsCreateSeriesModalOpen] = useState(false);

  // Estado de Actualidad y Comunidad
  const [actualidadCategory, setActualidadCategory] = useState('Todas');
  const [comunidadCategory, setComunidadCategory] = useState('Todos');
  const [selectedPost, setSelectedPost] = useState<PostRecord | null>(null);
  const [syncedPostUpdate, setSyncedPostUpdate] = useState<PostRecord | null>(
    null
  );
  const [deletedPostId, setDeletedPostId] = useState<string | null>(null);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

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

  const openSectionAssistant = useCallback((section: 'actualidad' | 'comunidad') => {
    setAiContext({ section });
    setAiInitialPrompt(null);
    setIsAiDrawerOpen(true);
  }, []);

  const openPostAssistant = useCallback(
    (post: PostRecord, initialPrompt?: string) => {
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
    setActiveReader(null);
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleSelectPost = useCallback((post: PostRecord) => {
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
    setActiveReader(null);
    setActiveView(publishedMode);
    if (publishedMode === 'actualidad') {
      setActualidadCategory('Todas');
    } else {
      setComunidadCategory('Todos');
    }
    setFeedRefreshKey((prev) => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectSeries = useCallback((series: SeriesRecord) => {
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
      />
    );
  }

  const defaultCreatePostMode: PostMode =
    activeView === 'comunidad' ? 'comunidad' : 'actualidad';

  const showFloatingCreatePostButton =
    isAuthenticated &&
    !selectedPost &&
    !selectedSeries &&
    !isCreatePostModalOpen &&
    !isCreateSeriesModalOpen &&
    (activeView === 'actualidad' || activeView === 'comunidad');

  return (
    <div className="min-h-dvh bg-[#090B0E] text-[#F2F4F8] flex flex-col">
      <Navbar
        activeView={activeView}
        onSelectView={handleSelectView}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />

      <main className="flex-1">
        {selectedPost ? (
          <PostDetailView
            initialPost={selectedPost}
            onBack={() => setSelectedPost(null)}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onPostUpdated={handlePostUpdated}
            onPostDeleted={handlePostDeleted}
            onOpenAssistant={openPostAssistant}
          />
        ) : selectedSeries ? (
          <SeriesDetailView
            initialSeries={selectedSeries}
            onBack={() => setSelectedSeries(null)}
            onOpenChapter={handleOpenChapter}
            onSeriesDeleted={handleSeriesDeleted}
            onSeriesChanged={() => setLibraryRefreshKey((prev) => prev + 1)}
          />
        ) : activeView === 'perfil' ? (
          <ProfileSection
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onSignedOut={() => handleSelectView('actualidad')}
          />
        ) : activeView === 'actualidad' ? (
          <ActualidadFeed
            selectedCategory={actualidadCategory}
            onSelectCategory={setActualidadCategory}
            refreshKey={feedRefreshKey}
            syncedPostUpdate={syncedPostUpdate}
            deletedPostId={deletedPostId}
            onSelectPost={handleSelectPost}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenCreate={() => setIsCreatePostModalOpen(true)}
            onOpenAssistant={() => openSectionAssistant('actualidad')}
          />
        ) : activeView === 'comunidad' ? (
          <ComunidadFeed
            selectedCategory={comunidadCategory}
            onSelectCategory={setComunidadCategory}
            refreshKey={feedRefreshKey}
            syncedPostUpdate={syncedPostUpdate}
            deletedPostId={deletedPostId}
            onSelectPost={handleSelectPost}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenCreate={() => setIsCreatePostModalOpen(true)}
            onOpenAssistant={() => openSectionAssistant('comunidad')}
          />
        ) : activeView === 'arcade' ? (
          <ArcadeSection />
        ) : (
          <BibliotecaCatalog
            selectedFilter={bibliotecaFilter}
            onSelectFilter={setBibliotecaFilter}
            searchQuery={bibliotecaSearch}
            onSearchQueryChange={setBibliotecaSearch}
            refreshKey={libraryRefreshKey}
            deletedSeriesId={deletedSeriesId}
            onSelectSeries={handleSelectSeries}
            onOpenCreateSeries={() => setIsCreateSeriesModalOpen(true)}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}
      </main>

      {/* Botón flotante "+" para Actualidad y Comunidad cuando el usuario inició sesión */}
      {showFloatingCreatePostButton && (
        <button
          type="button"
          onClick={() => setIsCreatePostModalOpen(true)}
          aria-label="Crear publicación"
          title="Crear publicación"
          className="fixed bottom-16 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#388BFF] text-[#06101F] shadow-lg shadow-[#388BFF]/25 hover:bg-[#529BFF] active:scale-95 transition-all duration-150 md:bottom-16 md:right-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090B0E]"
        >
          <Plus size={26} strokeWidth={2.4} aria-hidden="true" />
        </button>
      )}

      <CreatePostModal
        isOpen={isCreatePostModalOpen}
        defaultMode={defaultCreatePostMode}
        onClose={() => setIsCreatePostModalOpen(false)}
        onCreated={handlePostCreated}
      />

      <CreateSeriesModal
        isOpen={isCreateSeriesModalOpen}
        onClose={() => setIsCreateSeriesModalOpen(false)}
        onCreated={handleSeriesCreated}
      />

      <AiAssistantDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        context={aiContext}
        initialPrompt={aiInitialPrompt}
        onClearInitialPrompt={() => setAiInitialPrompt(null)}
      />

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
      <AppShell />
    </AuthProvider>
  );
}
