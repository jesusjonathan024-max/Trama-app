import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Flag,
  Loader2,
  X,
} from 'lucide-react';
import { REPORT_REASONS, submitContentReport } from '../lib/phase2';

interface ReportPostModalProps {
  isOpen: boolean;
  postId: string | null;
  postTitle?: string | null;
  reporterId: string | null;
  onClose: () => void;
  onSubmitted?: (postId: string) => void;
}

export function ReportPostModal({
  isOpen,
  postId,
  postTitle,
  reporterId,
  onClose,
  onSubmitted,
}: ReportPostModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(REPORT_REASONS[0]);
  const [extraDetail, setExtraDetail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedReason(REPORT_REASONS[0]);
    setExtraDetail('');
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(false);
  }, [isOpen, postId]);

  if (!isOpen || !postId) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!reporterId || !postId || isSubmitting) return;

    const trimmedDetail = extraDetail.trim();
    const composedReason =
      selectedReason === 'Otro motivo'
        ? trimmedDetail || 'Otro motivo'
        : trimmedDetail
        ? `${selectedReason}: ${trimmedDetail}`
        : selectedReason;

    if (selectedReason === 'Otro motivo' && trimmedDetail.length < 4) {
      setErrorMsg('Describe brevemente el motivo del reporte.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await submitContentReport({
        postId,
        reporterId,
        reason: composedReason,
      });
      setSuccessMsg('Reporte enviado al equipo editorial. Gracias por avisar.');
      onSubmitted?.(postId);
      setTimeout(() => {
        onClose();
      }, 1100);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo enviar tu reporte.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-post-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-2xl overflow-hidden transition-colors duration-300">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-rose-400" />
            <h2
              id="report-post-title"
              className="text-base font-semibold text-[var(--text-main)]"
            >
              Reportar publicación
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Cerrar ventana"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {postTitle && (
            <p className="text-xs text-[var(--text-muted)] line-clamp-2 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-xl px-3 py-2">
              Publicación: <span className="text-[var(--text-main)] font-medium">{postTitle}</span>
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
              Motivo del reporte
            </label>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <label
                    key={reason}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-rose-500/45 bg-rose-500/10 text-[var(--text-main)] font-medium'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={reason}
                      checked={isSelected}
                      onChange={() => setSelectedReason(reason)}
                      className="accent-rose-500"
                    />
                    <span>{reason}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="report-extra-detail"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Detalle adicional{' '}
              <span className="text-[var(--text-muted)] font-normal">
                ({selectedReason === 'Otro motivo' ? 'obligatorio' : 'opcional'})
              </span>
            </label>
            <textarea
              id="report-extra-detail"
              value={extraDetail}
              onChange={(e) => setExtraDetail(e.target.value)}
              rows={3}
              maxLength={360}
              placeholder="Agrega contexto breve o indica qué dato parece inexacto..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-rose-500/60 resize-none transition-colors"
            />
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/25 px-3.5 py-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3.5 py-2.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || Boolean(successMsg)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Flag className="w-3.5 h-3.5" />
                  Enviar reporte
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
