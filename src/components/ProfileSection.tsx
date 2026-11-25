import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  LogOut,
  Save,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MEDIA_BUCKET, isSafeHttpUrl, supabase } from '../lib/supabase';
import { Avatar } from './Avatar';

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
    isLoadingSession,
    isLoadingProfile,
    setProfileState,
    signOut,
  } = useAuth();

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
        .select('id, username, bio, avatar_url')
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
      .select('id, username, bio, avatar_url')
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
          <div className="h-8 w-44 rounded-lg bg-[#151922]" />
          <div className="h-64 w-full rounded-2xl bg-[#12151C] border border-white/[0.07]" />
        </div>
      </section>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <section className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-xl flex-col items-center justify-center px-5 py-16 text-center">
        <h1 className="text-balance font-display text-3xl font-bold tracking-tight text-white">
          Mi Perfil
        </h1>
        <p className="mt-3 text-base text-[#97A1B2]">
          Inicia sesión o crea una cuenta para editar tu nombre de usuario, tu biografía y tu foto de perfil.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="mt-7 min-h-[48px] rounded-xl bg-[#388BFF] px-5 py-3 text-sm font-semibold text-[#06101F] hover:bg-[#529BFF] active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
        >
          Iniciar sesión / Registrarse
        </button>
      </section>
    );
  }

  const hasUnsavedChanges =
    username.trim() !== (profile?.username ?? '').trim() ||
    bio.trim() !== (profile?.bio ?? '').trim();

  return (
    <section
      aria-labelledby="profile-heading"
      className="mx-auto max-w-4xl px-4 py-8 pb-28 sm:px-6 md:px-8 md:py-12 md:pb-16"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b border-white/[0.08] pb-6">
        <div>
          <h1
            id="profile-heading"
            className="font-display text-3xl font-bold tracking-tight text-white"
          >
            Mi Perfil
          </h1>
          <p className="mt-1.5 text-sm text-[#97A1B2]">
            Administra tu información pública y tu foto de perfil.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="mt-3 sm:mt-0 min-h-[44px] self-start sm:self-auto inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-[#12151C] px-4 py-2 text-sm font-medium text-[#D5DCE6] hover:border-white/[0.2] hover:bg-[#191E2A] hover:text-white disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
        >
          {isSigningOut ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <LogOut size={16} aria-hidden="true" />
          )}
          <span>Cerrar sesión</span>
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Columna izquierda: Foto de perfil e identidad de cuenta */}
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#11151D] p-6">
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
                      className="animate-spin text-[#529BFF]"
                      aria-label="Subiendo foto"
                    />
                  </div>
                )}
              </div>

              <h2 className="mt-4 font-display text-lg font-semibold text-white max-w-full truncate">
                {username.trim() || 'Sin nombre de usuario'}
              </h2>
              <p className="mt-1 text-xs text-[#8B95A5] max-w-full truncate">
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
                className="mt-5 min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-[#171C27] px-4 py-2.5 text-sm font-medium text-[#EEF2F7] hover:bg-[#1E2533] disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF]"
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

              <p className="mt-3 text-xs text-[#7B8597]">
                JPG, PNG, WebP o GIF · Máx. 5 MB
              </p>
            </div>
          </div>
        </div>

        {/* Columna derecha: Formulario de username y bio */}
        <div className="lg:col-span-8">
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl border border-white/[0.08] bg-[#11151D] p-6 sm:p-7"
          >
            {isLoadingProfile ? (
              <div className="space-y-5 animate-pulse">
                <div className="h-12 w-full rounded-xl bg-[#181D27]" />
                <div className="h-32 w-full rounded-xl bg-[#181D27]" />
                <div className="h-12 w-40 rounded-xl bg-[#181D27]" />
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label
                    htmlFor="profile-username"
                    className="mb-2 block text-sm font-medium text-[#D5DCE6]"
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
                    className="min-h-[46px] w-full rounded-xl border border-white/[0.1] bg-[#0B0E14] px-3.5 text-sm text-white placeholder:text-[#667085] focus:border-[#388BFF] focus:outline-none focus:ring-2 focus:ring-[#388BFF]/30 transition-colors"
                  />
                  <p className="mt-1.5 text-xs text-[#7B8597]">
                    Así aparecerás en la plataforma.
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label
                      htmlFor="profile-bio"
                      className="block text-sm font-medium text-[#D5DCE6]"
                    >
                      Biografía
                    </label>
                    <span className="text-xs tabular-nums text-[#7B8597]">
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
                    className="w-full resize-none rounded-xl border border-white/[0.1] bg-[#0B0E14] px-3.5 py-3 text-sm leading-relaxed text-white placeholder:text-[#667085] focus:border-[#388BFF] focus:outline-none focus:ring-2 focus:ring-[#388BFF]/30 transition-colors"
                  />
                </div>

                {feedback && (
                  <div
                    role={feedback.type === 'error' ? 'alert' : 'status'}
                    className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
                      feedback.type === 'error'
                        ? 'border-red-500/30 bg-red-500/10 text-red-200'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    }`}
                  >
                    {feedback.type === 'error' ? (
                      <AlertCircle
                        size={18}
                        className="mt-0.5 shrink-0 text-red-400"
                        aria-hidden="true"
                      />
                    ) : (
                      <CheckCircle2
                        size={18}
                        className="mt-0.5 shrink-0 text-emerald-400"
                        aria-hidden="true"
                      />
                    )}
                    <span>{feedback.message}</span>
                  </div>
                )}

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="submit"
                    disabled={isSaving || isUploadingAvatar || (!hasUnsavedChanges && profileExists)}
                    className="min-h-[48px] w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#388BFF] px-6 py-3 text-sm font-semibold text-[#06101F] hover:bg-[#529BFF] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#388BFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#11151D]"
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
