import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, X, Sparkles } from 'lucide-react';
import { isVideoUrl, optimizeCloudinaryUrl } from '../utils/cloudinary';

interface AestheticMediaViewerProps {
  url?: string;
  alt?: string;
  aspectRatioClass?: string; // 'dynamic' or explicit class like 'aspect-[16/10]'
  className?: string;
  allowExpand?: boolean;
  autoPlayMuted?: boolean;
  showControls?: boolean;
  badge?: string;
  objectPosition?: string;
  onBook?: () => void;
  mediaFormat?: 'dynamic' | 'vertical' | 'square' | 'horizontal';
}

export const AestheticMediaViewer: React.FC<AestheticMediaViewerProps> = ({
  url,
  alt = 'Visuel prestation',
  aspectRatioClass = 'dynamic',
  className = '',
  allowExpand = true,
  autoPlayMuted = true,
  showControls = true,
  badge,
  objectPosition = 'center center',
  onBook,
  mediaFormat = 'dynamic',
}) => {
  const [isPlaying, setIsPlaying] = useState(autoPlayMuted);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [isVerticalVideo, setIsVerticalVideo] = useState(false);
  const [detectedRatio, setDetectedRatio] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const modalVideoRef = useRef<HTMLVideoElement | null>(null);

  const isVideo = isVideoUrl(url);

  // Reset states when URL changes
  useEffect(() => {
    setMediaError(false);
    setProgress(0);
    setIsVerticalVideo(false);
    setDetectedRatio(null);
  }, [url]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setDetectedRatio(img.naturalWidth / img.naturalHeight);
    }
  };

  const handleVideoMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (v.videoWidth && v.videoHeight) {
      setDetectedRatio(v.videoWidth / v.videoHeight);
    }
    if (v.videoHeight > v.videoWidth) {
      setIsVerticalVideo(true);
    }
  };

  // Determine effective aspect ratio
  const targetRatio = useMemo(() => {
    if (mediaFormat === 'vertical') return 4 / 5;
    if (mediaFormat === 'square') return 1;
    if (mediaFormat === 'horizontal') return 16 / 10;

    if (aspectRatioClass && aspectRatioClass !== 'dynamic') {
      return null; // Tailwind aspect class specified
    }

    if (detectedRatio) {
      // Dynamic mode: clamp safely between 9:16 (0.5625) and 21:9 (2.33)
      return Math.max(0.56, Math.min(2.2, detectedRatio));
    }

    return null;
  }, [mediaFormat, aspectRatioClass, detectedRatio]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return;

    const handleTimeUpdate = () => {
      if (video.duration && Number.isFinite(video.duration) && video.duration > 0) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isVideo, url]);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(false);
        });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const openModal = (e?: React.MouseEvent) => {
    if (!allowExpand) return;
    if (e) e.stopPropagation();
    setIsModalOpen(true);
  };

  if (!url || mediaError) {
    return (
      <div
        className={`relative ${
          aspectRatioClass && aspectRatioClass !== 'dynamic' ? aspectRatioClass : 'aspect-[16/10]'
        } w-full overflow-hidden bg-ivory/60 border-b border-charcoal/10 flex flex-col items-center justify-center p-6 text-center text-taupe ${className}`}
      >
        <Sparkles className="h-6 w-6 opacity-40 mb-1" />
        <span className="text-[10px] uppercase tracking-widest font-medium">Alshana's Glow</span>
        {alt && <span className="text-[9px] text-taupe/70 mt-1 line-clamp-1">{alt}</span>}
      </div>
    );
  }

  return (
    <>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={openModal}
        title={isVideo ? 'Cliquer pour visionner la vidéo en grand format' : "Cliquer pour agrandir l'image"}
        style={
          targetRatio
            ? {
                aspectRatio: `${targetRatio}`,
                maxHeight: '72vh',
              }
            : undefined
        }
        className={`group relative ${
          targetRatio
            ? ''
            : aspectRatioClass && aspectRatioClass !== 'dynamic'
            ? aspectRatioClass
            : 'aspect-[16/10]'
        } w-full overflow-hidden bg-obsidian border-b border-charcoal/10 select-none cursor-pointer ${className}`}
      >
        {isVideo ? (
          <div className="relative h-full w-full overflow-hidden">
            {/* Arrière-plan flou d'ambiance uniquement si ratio fixe différent du média */}
            {isVerticalVideo && !targetRatio && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
                <video
                  src={url}
                  autoPlay={autoPlayMuted}
                  loop
                  muted
                  playsInline
                  aria-hidden="true"
                  className="h-full w-full object-cover scale-125 filter blur-xl opacity-40 brightness-75 select-none"
                />
              </div>
            )}

            <video
              ref={videoRef}
              src={url}
              autoPlay={autoPlayMuted}
              loop
              muted={isMuted}
              playsInline
              preload="metadata"
              onLoadedMetadata={handleVideoMetadata}
              onError={() => setMediaError(true)}
              style={{ objectPosition }}
              className="relative z-10 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />

            {/* Custom Aesthetic Controls Overlay avec z-20 pour une interactivité immédiate */}
            {showControls && (
              <div
                className={`absolute inset-0 z-20 flex flex-col justify-between bg-gradient-to-t from-obsidian/80 via-transparent to-obsidian/30 p-3 transition-opacity duration-300 ${
                  isHovered || !isPlaying ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {/* Top header badge & expand */}
                <div className="flex items-center justify-between">
                  {badge ? (
                    <span className="border border-ivory/20 bg-obsidian/75 px-2 py-0.5 text-[9px] font-medium tracking-widest text-ivory uppercase backdrop-blur-xs">
                      {badge}
                    </span>
                  ) : (
                    <span className="border border-ivory/20 bg-obsidian/75 px-2 py-0.5 text-[9px] font-medium tracking-widest text-ivory uppercase backdrop-blur-xs">
                      Vidéo
                    </span>
                  )}

                  {allowExpand && (
                    <button
                      type="button"
                      onClick={openModal}
                      aria-label="Visionner en plein écran"
                      title="Visionner en plein écran"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-obsidian/80 text-ivory backdrop-blur-xs transition-colors hover:bg-ivory hover:text-charcoal cursor-pointer"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Center subtle Play/Pause & View Prompt */}
                <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                  <div className="pointer-events-auto">
                    <button
                      type="button"
                      onClick={togglePlay}
                      aria-label={isPlaying ? 'Pause' : 'Lecture'}
                      className="flex h-12 w-12 items-center justify-center rounded-full border border-ivory/40 bg-obsidian/85 text-ivory backdrop-blur-md shadow-lg transition-all hover:scale-110 hover:border-ivory cursor-pointer"
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
                    </button>
                  </div>
                  <span className="text-[9px] tracking-wider text-ivory/90 uppercase font-medium drop-shadow-sm">
                    {isPlaying ? 'Pause' : 'Lire'} · Cliquez pour agrandir
                  </span>
                </div>

                {/* Bottom toolbar with progress & sound */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-ivory/80">
                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
                      className="flex items-center gap-1 rounded bg-obsidian/60 px-2 py-0.5 text-ivory backdrop-blur-xs hover:bg-obsidian cursor-pointer"
                    >
                      {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                      <span className="text-[9px] tracking-wider uppercase">{isMuted ? 'Son coupé' : 'Son activé'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={openModal}
                      className="text-[9px] tracking-widest uppercase text-ivory/80 hover:text-white"
                    >
                      Plein écran ↗
                    </button>
                  </div>

                  {/* Elegant Golden/Ivory Progress Bar */}
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full bg-ivory transition-all duration-150"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative h-full w-full">
            <img
              src={optimizeCloudinaryUrl(url, 1200)}
              alt={alt}
              loading="lazy"
              onLoad={handleImageLoad}
              onError={() => setMediaError(true)}
              style={{ objectPosition }}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />

            {badge && (
              <div className="absolute top-3 left-3 z-10">
                <span className="border border-charcoal/20 bg-white/95 px-2.5 py-0.5 text-[10px] font-medium tracking-widest text-charcoal uppercase">
                  {badge}
                </span>
              </div>
            )}

            {allowExpand && (
              <button
                type="button"
                onClick={openModal}
                aria-label="Agrandir l'image"
                className="absolute right-3 bottom-3 flex h-7 w-7 items-center justify-center rounded-full bg-obsidian/70 text-ivory opacity-0 backdrop-blur-xs transition-all duration-300 hover:bg-obsidian group-hover:opacity-100"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen HD Modal with responsive Vertical / Horizontal layout */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/90 p-4 backdrop-blur-md animate-fade-in"
        >
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            aria-label="Fermer"
            className="absolute top-5 right-5 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-obsidian/80 text-ivory transition-colors hover:border-white hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[90dvh] max-w-4xl flex-col items-center justify-center overflow-hidden border border-white/10 bg-black/60 p-2 shadow-2xl"
          >
            {isVideo ? (
              <video
                ref={modalVideoRef}
                src={url}
                controls
                autoPlay
                playsInline
                className="max-h-[85dvh] max-w-full rounded-xs object-contain"
              />
            ) : (
              <img
                src={optimizeCloudinaryUrl(url, 1600)}
                alt={alt}
                className="max-h-[85dvh] max-w-full rounded-xs object-contain"
              />
            )}
            <p className="mt-2 text-center text-xs tracking-wider text-stone/80 uppercase">
              {alt} · Alshana's Glow
            </p>

            {onBook && (
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  onBook();
                }}
                className="mt-3 inline-flex items-center gap-2 border border-ivory/30 bg-charcoal/90 px-6 py-2.5 text-xs font-semibold tracking-widest text-ivory uppercase hover:bg-ivory hover:text-charcoal transition-colors cursor-pointer"
              >
                <span>Réserver ce soin</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
