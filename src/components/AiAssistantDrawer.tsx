import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  AlertCircle,
  ExternalLink,
  Globe,
  Loader2,
  LogIn,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  MAX_AI_PROMPT_LENGTH,
  sendAiChat,
  type AiChatContext,
  type AiChatTurn,
  type AiGroundingSource,
} from '../lib/ai';
import { isSafeHttpUrl } from '../lib/supabase';

interface ChatMessageItem extends AiChatTurn {
  id: string;
  sources?: AiGroundingSource[];
}

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth?: () => void;
  context: AiChatContext | null;
  initialPrompt?: string | null;
  onClearInitialPrompt?: () => void;
}

function renderInlineBold(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((segment, idx) => {
    if (segment.startsWith('**') && segment.endsWith('**') && segment.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {segment.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{segment}</span>;
  });
}

function FormattedAssistantText({ text }: { text: string }) {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-[#DDE4F0]">
      {blocks.map((block, blockIdx) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        const isBulletList =
          lines.length > 0 &&
          lines.every((l) => l.startsWith('- ') || l.startsWith('* ') || l.startsWith('• '));

        if (isBulletList) {
          return (
            <ul key={blockIdx} className="space-y-1.5 pl-4 list-disc marker:text-[#7FB2FF]">
              {lines.map((line, lineIdx) => (
                <li key={lineIdx} className="break-words">
                  {renderInlineBold(line.replace(/^[-*•]\s+/, ''))}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockIdx} className="whitespace-pre-line break-words">
            {renderInlineBold(block)}
          </p>
        );
      })}
    </div>
  );
}

export function AiAssistantDrawer({
  isOpen,
  onClose,
  onOpenAuth,
  context,
  initialPrompt,
  onClearInitialPrompt,
}: AiAssistantDrawerProps) {
  const { isAuthenticated, isLoadingSession } = useAuth();
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [useSearch, setUseSearch] = useState(true);
  const [activeContext, setActiveContext] = useState<AiChatContext | null>(context);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const lastContextKeyRef = useRef<string>('');
  const autoSentPromptRef = useRef<string | null>(null);

  const contextKey = context
    ? `${context.section}:${context.title ?? ''}:${(context.content ?? '').slice(0, 60)}`
    : 'none';

  useEffect(() => {
    if (!isOpen) return;
    if (contextKey !== lastContextKeyRef.current) {
      lastContextKeyRef.current = contextKey;
      setActiveContext(context);
    }
  }, [isOpen, context, contextKey]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const dispatchMessage = useCallback(
    async (rawText: string, overrideContext?: AiChatContext | null) => {
      if (!isAuthenticated) {
        setErrorMsg('Inicia sesión en tu cuenta de Trama para consultar al Asistente IA.');
        return;
      }

      const trimmed = rawText.trim();
      if (!trimmed || isSending) return;

      if (trimmed.length > MAX_AI_PROMPT_LENGTH) {
        setErrorMsg(
          `El mensaje supera el límite máximo de ${MAX_AI_PROMPT_LENGTH.toLocaleString('es-ES')} caracteres.`
        );
        return;
      }

      const userTurn: ChatMessageItem = {
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        text: trimmed,
      };

      const nextHistory = [...messages, userTurn];
      setMessages(nextHistory);
      setInputValue('');
      setErrorMsg(null);
      setIsSending(true);

      try {
        const result = await sendAiChat({
          messages: nextHistory.map(({ role, text }) => ({ role, text })),
          context: overrideContext !== undefined ? overrideContext ?? undefined : activeContext ?? undefined,
          useSearch,
        });

        const modelTurn: ChatMessageItem = {
          id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'model',
          text: result.text,
          sources: result.sources,
        };
        setMessages((prev) => [...prev, modelTurn]);
      } catch (err) {
        setMessages((prev) => prev.filter((item) => item.id !== userTurn.id));
        setInputValue(trimmed);
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'No se pudo obtener respuesta del asistente.'
        );
      } finally {
        setIsSending(false);
      }
    },
    [activeContext, isAuthenticated, isSending, messages, useSearch]
  );

  useEffect(() => {
    if (!isOpen || !initialPrompt) {
      autoSentPromptRef.current = null;
      return;
    }
    if (!isAuthenticated) {
      setActiveContext(context);
      onClearInitialPrompt?.();
      return;
    }
    const triggerKey = `${contextKey}|${initialPrompt}`;
    if (autoSentPromptRef.current === triggerKey) return;
    autoSentPromptRef.current = triggerKey;
    setActiveContext(context);
    void dispatchMessage(initialPrompt, context);
    onClearInitialPrompt?.();
  }, [isOpen, initialPrompt, isAuthenticated, context, contextKey, dispatchMessage, onClearInitialPrompt]);

  if (!isOpen) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void dispatchMessage(inputValue);
  }

  function handleResetConversation() {
    setMessages([]);
    setErrorMsg(null);
  }

  const hasArticleContext = Boolean(activeContext?.content);
  const starterPrompts = hasArticleContext
    ? [
        'Resúmeme los puntos clave en 4 viñetas',
        'Verifica con Google los datos y fechas mencionados aquí',
        '¿Qué contexto reciente falta para entender mejor este tema?',
      ]
    : activeContext?.section === 'comunidad'
      ? [
          '¿Qué novedades recientes hay en anime, manga o novelas esta semana?',
          'Ayúdame a contrastar un dato curioso para un debate',
          'Recomiéndame temas de conversación actuales para Comunidad',
        ]
      : [
          'Resume las noticias tecnológicas más importantes de hoy',
          'Verifica un dato económico o mundial reciente con Google',
          'Explícame en simple qué está pasando en economía global hoy',
        ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-assistant-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="flex-1"
      />

      <aside className="flex h-dvh w-full max-w-lg flex-col border-l border-white/[0.09] bg-[#0C1017] shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#388BFF]/30 bg-[#388BFF]/12 text-[#7FB2FF]">
              <Sparkles size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="ai-assistant-title"
                className="font-display text-base font-bold tracking-tight text-white truncate"
              >
                Asistente Trama IA
              </h2>
              <p className="text-xs text-[#8F99AB] truncate">
                Resumen, dudas y verificación con Google
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleResetConversation}
                title="Nueva conversación"
                aria-label="Nueva conversación"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-[#8F99AB] hover:bg-white/[0.06] hover:text-white transition-colors"
              >
                <RotateCcw size={16} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar asistente"
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl text-[#8F99AB] hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Barra de contexto y búsqueda en vivo */}
        <div className="border-b border-white/[0.07] bg-[#101520] px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-[#CBD5E1] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useSearch}
                onChange={(event) => setUseSearch(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-[#090B0E] accent-[#388BFF]"
              />
              <Globe size={14} className="text-[#7FB2FF]" aria-hidden="true" />
              <span>Búsqueda en Google en vivo</span>
            </label>

            {hasArticleContext && (
              <button
                type="button"
                onClick={() => setActiveContext(null)}
                className="text-[11px] font-medium text-[#8F99AB] hover:text-white transition-colors"
              >
                Quitar contexto
              </button>
            )}
          </div>

          {hasArticleContext && activeContext && (
            <div className="mt-2 rounded-lg border border-white/[0.08] bg-[#0B0E14] px-3 py-2 text-xs text-[#C8D1DF]">
              <span className="font-semibold text-[#7FB2FF]">
                {activeContext.section === 'comunidad' ? 'Hilo activo:' : 'Artículo activo:'}
              </span>{' '}
              <span className="line-clamp-1">
                {activeContext.title || activeContext.content?.slice(0, 90)}
              </span>
            </div>
          )}
        </div>

        {/* Historial de mensajes o aviso de inicio de sesión */}
        {!isLoadingSession && !isAuthenticated ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#388BFF]/30 bg-[#388BFF]/12 text-[#7FB2FF]">
              <LogIn size={22} aria-hidden="true" />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-white">
              Inicia sesión para usar el Asistente IA
            </h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#9AA4B6]">
              Para proteger el servicio y llevar el control de tu cuota diaria, necesitas tener una sesión activa en Trama antes de consultar al asistente.
            </p>
            {onOpenAuth && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="mt-6 min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#388BFF] px-5 py-2.5 text-sm font-semibold text-[#06101F] hover:bg-[#529BFF] active:scale-[0.98] transition-all"
              >
                <LogIn size={16} aria-hidden="true" />
                <span>Iniciar sesión / Registrarse</span>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 sm:px-5">
              {messages.length === 0 ? (
                <div className="py-4">
                  <p className="text-sm leading-relaxed text-[#9AA4B6]">
                    {hasArticleContext
                      ? 'Tengo esta publicación cargada. Pídeme un resumen rápido, aclaraciones o verificación de datos recientes en Google.'
                      : 'Pregúntame sobre noticias recientes, contrasta un dato o pide ayuda para investigar un tema de Actualidad o Comunidad.'}
                  </p>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-medium text-[#7C8699]">
                      Sugerencias rápidas
                    </p>
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        disabled={isSending}
                        onClick={() => void dispatchMessage(prompt)}
                        className="w-full min-h-[44px] rounded-xl border border-white/[0.08] bg-[#121722] px-3.5 py-2.5 text-left text-xs font-medium text-[#DCE3F0] hover:border-[#388BFF]/40 hover:bg-[#171E2C] transition-colors disabled:opacity-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-[#388BFF] text-[#06101F] text-sm font-medium'
                          : 'border border-white/[0.08] bg-[#121722] text-[#E5EBF5]'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-line break-words">{msg.text}</p>
                      ) : (
                        <FormattedAssistantText text={msg.text} />
                      )}
                    </div>

                    {msg.role === 'model' && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 max-w-[92%] space-y-1.5">
                        <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#8B95A5]">
                          <Globe size={12} className="text-[#7FB2FF]" aria-hidden="true" />
                          <span>Fuentes verificadas en Google</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources
                            .filter((source) => isSafeHttpUrl(source.uri))
                            .map((source) => (
                              <a
                                key={source.uri}
                                href={source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/[0.09] bg-[#111621] px-2.5 py-1 text-[11px] font-medium text-[#9EC5FF] hover:border-[#388BFF]/45 hover:text-white transition-colors"
                              >
                                <span className="truncate max-w-[200px]">
                                  {source.title}
                                </span>
                                <ExternalLink
                                  size={11}
                                  className="shrink-0 opacity-75"
                                  aria-hidden="true"
                                />
                              </a>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {isSending && (
                <div className="flex items-start">
                  <div className="inline-flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-[#121722] px-4 py-3 text-xs text-[#9AA4B6]">
                    <Loader2 size={15} className="animate-spin text-[#7FB2FF]" aria-hidden="true" />
                    <span>
                      {useSearch
                        ? 'Consultando Gemini y verificando en Google…'
                        : 'Generando respuesta…'}
                    </span>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-red-500/35 bg-red-500/12 px-3.5 py-3 text-xs text-red-100"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" aria-hidden="true" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div ref={scrollEndRef} />
            </div>

            {/* Formulario inferior */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-white/[0.08] bg-[#0B0E14] p-3 pb-safe sm:p-4"
            >
              <div className="flex items-end gap-2">
                <label htmlFor="ai-chat-input" className="sr-only">
                  Escribe tu consulta para el asistente IA
                </label>
                <textarea
                  id="ai-chat-input"
                  rows={2}
                  maxLength={MAX_AI_PROMPT_LENGTH}
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void dispatchMessage(inputValue);
                    }
                  }}
                  placeholder="Pregunta algo, pide un resumen o verifica un dato…"
                  className="flex-1 resize-none rounded-xl border border-white/[0.1] bg-[#121722] px-3.5 py-2.5 text-sm text-white placeholder:text-[#6B768B] focus:border-[#388BFF] focus:outline-none focus:ring-2 focus:ring-[#388BFF]/30"
                />
                <button
                  type="submit"
                  disabled={isSending || !inputValue.trim()}
                  aria-label="Enviar mensaje"
                  className="min-h-[46px] min-w-[46px] shrink-0 inline-flex items-center justify-center rounded-xl bg-[#388BFF] text-[#06101F] hover:bg-[#529BFF] disabled:opacity-45 active:scale-95 transition-all"
                >
                  {isSending ? (
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Send size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
              {inputValue.length > 1500 && (
                <p className="mt-1.5 text-right text-[11px] tabular-nums text-[#8F99AB]">
                  {inputValue.length.toLocaleString('es-ES')} /{' '}
                  {MAX_AI_PROMPT_LENGTH.toLocaleString('es-ES')} caracteres
                </p>
              )}
            </form>
          </>
        )}
      </aside>
    </div>
  );
}
