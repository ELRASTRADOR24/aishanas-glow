import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, X, Sparkles } from 'lucide-react';
import { isVideoUrl, optimizeCloudinaryUrl } from '../utils/cloudinary';

interface AestheticMediaViewerProps {
  url?: string;
  alt?: string;
  aspectRatioClass?: string;
  className?: string;
  allowExpand?: boolean;
  autoPlayMuted?: boolean;
  showControls?: boolean;
  badge?: string;
}

export const AestheticMediaViewer: React.FC<AestheticMediaViewerProps> = ({
  url,
  alt = 'Visuel prestation',
  aspectRatioClass = 'aspect-[16/10]',
  className = '',
  allowExpand = true,
  autoPlayMuted = true,
  showControls = true,
  badge,
}) => {
  const [isPlaying, setIsPlaying] = useState(autoPlayMuted);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const modalVideoRef = useRef<HTMLVideoElement | null>(null);

  const isVideo = isVideoUrl(url);

  // Reset error when URL changes
  useEffect(() => {
    setMediaError(false);
    setProgress(0);
  }, [url]);

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
        className={`relative ${aspectRatioClass} w-full overflow-hidden bg-ivory/60 border-b border-charcoal/10 flex flex-col items-center justify-center p-6 text-center text-taupe ${className}`}
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
        className={`group relative ${aspectRatioClass} w-full overflow-hidden bg-obsidian border-b border-charcoal/10 select-none ${className}`}
      >
        {isVideo ? (
          <div className="relative h-full w-full">
            <video
              ref={videoRef}
              src={url}
              autoPlay={autoPlayMuted}
              loop
              muted={isMuted}
              playsInline
              preload="metadata"
              onError={() => setMediaError(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />

            {/* Custom Aesthetic Controls Overlay */}
            {showControls && (
              <div
                className={`absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-obsidian/80 via-transparent to-obsidian/30 p-3 transition-opacity duration-300 ${
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
                      aria-label="Agrandir la vidéo"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-obsidian/70 text-ivory backdrop-blur-xs transition-colors hover:bg-obsidian hover:text-white"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Center subtle Play/Pause button */}
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Pause' : 'Lecture'}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-ivory/30 bg-obsidian/80 text-ivory backdrop-blur-md transition-all hover:scale-110 hover:border-ivory cursor-pointer"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
                  </button>
                </div>

                {/* Bottom toolbar with progress & sound */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-ivory/80">
                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/10"
                    >
                      {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                      <span className="text-[9px] tracking-wider uppercase">{isMuted ? 'Muet' : 'Son'}</span>
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
              src={optimizeCloudinaryUrl(url, 600)}
              alt={alt}
              loading="lazy"
              onError={() => setMediaError(true)}
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
          </div>
        </div>
      )}
    </>
  );
};
