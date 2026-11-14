import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Sparkles,
  Loader2,
  Smartphone,
  Tablet,
  Monitor,
} from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  fileName?: string;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob, croppedFileName: string) => Promise<void> | void;
  aspectRatio?: number; // default: 16 / 10 = 1.6
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  fileName = 'photo-studio.jpg',
  onClose,
  onCropComplete,
  aspectRatio = 16 / 10,
}) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Reset controls when opened
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsProcessing(false);
    }
  }, [isOpen, imageSrc]);

  // Touch & Mouse Drag handlers
  const handleStartDrag = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMoveDrag = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    });
  };

  const handleEndDrag = () => {
    setIsDragging(false);
  };

  // Quick Preset Alignments
  const alignTop = () => {
    if (!imageRef.current || !containerRef.current) return;
    const containerHeight = containerRef.current.clientHeight;
    const imgHeight = imageRef.current.clientHeight * zoom;
    const maxOffset = Math.max(0, (imgHeight - containerHeight) / 2);
    setPosition({ x: 0, y: maxOffset });
  };

  const alignCenter = () => {
    setPosition({ x: 0, y: 0 });
  };

  const alignBottom = () => {
    if (!imageRef.current || !containerRef.current) return;
    const containerHeight = containerRef.current.clientHeight;
    const imgHeight = imageRef.current.clientHeight * zoom;
    const maxOffset = Math.max(0, (imgHeight - containerHeight) / 2);
    setPosition({ x: 0, y: -maxOffset });
  };

  // Generate cropped blob from canvas
  const handleValidateCrop = async () => {
    if (!imageRef.current || !containerRef.current) return;
    setIsProcessing(true);

    try {
      const container = containerRef.current;
      const img = imageRef.current;

      const containerRect = container.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();

      // Target canvas resolution (1600 x 1000 for sharp 16:10 retina display)
      const exportWidth = 1600;
      const exportHeight = Math.round(exportWidth / aspectRatio);

      const canvas = document.createElement('canvas');
      canvas.width = exportWidth;
      canvas.height = exportHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Impossible de créer le rendu graphique.');
      }

      // Smooth anti-aliased image rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Calculate mapping from visible container to natural image dimensions
      const scaleX = img.naturalWidth / imgRect.width;
      const scaleY = img.naturalHeight / imgRect.height;

      const cropX = (containerRect.left - imgRect.left) * scaleX;
      const cropY = (containerRect.top - imgRect.top) * scaleY;
      const cropWidth = containerRect.width * scaleX;
      const cropHeight = containerRect.height * scaleY;

      // Draw onto export canvas
      ctx.drawImage(
        img,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        exportWidth,
        exportHeight
      );

      // Convert to WebP (fallback to JPEG)
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Erreur de conversion de la photo.'));
          },
          'image/webp',
          0.92
        );
      });

      const cleanBaseName = fileName.replace(/\.[^.]+$/, '');
      const croppedFileName = `${cleanBaseName}-cadre-16x10.webp`;

      await onCropComplete(blob, croppedFileName);
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Erreur lors du recadrage.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/85 p-3 sm:p-6 backdrop-blur-md animate-fade-in"
    >
      <div className="relative flex max-h-[95vh] w-full max-w-4xl flex-col border border-white/20 bg-obsidian text-ivory shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-stone" />
            <div>
              <h3 className="font-serif text-lg font-medium text-ivory sm:text-xl">
                Recadrer &amp; Ajuster la photo
              </h3>
              <p className="text-[11px] text-stone/75">
                Format standard des prestations (16:10) — adapté smartphone, tablette et écran.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer sans enregistrer"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-stone hover:bg-white/10 hover:text-ivory"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Device simulation indicator */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-5 py-2.5 text-xs text-stone">
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-wider uppercase text-stone/70">
              Aperçu selon l’écran :
            </span>
            <div className="flex items-center gap-1 border border-white/10 bg-obsidian p-0.5">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] transition-colors ${
                  previewDevice === 'desktop'
                    ? 'bg-ivory text-obsidian font-semibold'
                    : 'text-stone hover:text-ivory'
                }`}
              >
                <Monitor className="h-3 w-3" />
                <span>Ordinateur</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('tablet')}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] transition-colors ${
                  previewDevice === 'tablet'
                    ? 'bg-ivory text-obsidian font-semibold'
                    : 'text-stone hover:text-ivory'
                }`}
              >
                <Tablet className="h-3 w-3" />
                <span>Tablette</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] transition-colors ${
                  previewDevice === 'mobile'
                    ? 'bg-ivory text-obsidian font-semibold'
                    : 'text-stone hover:text-ivory'
                }`}
              >
                <Smartphone className="h-3 w-3" />
                <span>Smartphone</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-stone/80">
            <Move className="h-3.5 w-3.5 text-stone" />
            <span>Glissez pour déplacer · Zoomez ci-dessous</span>
          </div>
        </div>

        {/* Viewport de recadrage interactif */}
        <div className="flex flex-1 items-center justify-center overflow-hidden bg-black/70 p-4 sm:p-6">
          <div
            className={`transition-all duration-300 w-full ${
              previewDevice === 'mobile'
                ? 'max-w-[340px]'
                : previewDevice === 'tablet'
                ? 'max-w-[540px]'
                : 'max-w-[700px]'
            }`}
          >
            {/* Fenêtre de cadrage avec ratio strict 16:10 */}
            <div
              ref={containerRef}
              style={{ aspectRatio: `${aspectRatio}` }}
              onMouseDown={(e) => handleStartDrag(e.clientX, e.clientY)}
              onMouseMove={(e) => handleMoveDrag(e.clientX, e.clientY)}
              onMouseUp={handleEndDrag}
              onMouseLeave={handleEndDrag}
              onTouchStart={(e) => {
                if (e.touches[0]) handleStartDrag(e.touches[0].clientX, e.touches[0].clientY);
              }}
              onTouchMove={(e) => {
                if (e.touches[0]) handleMoveDrag(e.touches[0].clientX, e.touches[0].clientY);
              }}
              onTouchEnd={handleEndDrag}
              className="relative w-full overflow-hidden border-2 border-ivory/80 bg-obsidian cursor-grab active:cursor-grabbing select-none shadow-[0_0_40px_rgba(0,0,0,0.8)]"
            >
              <img
                ref={imageRef}
                src={imageSrc}
                alt="À recadrer"
                draggable={false}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                }}
                className="max-h-none max-w-none pointer-events-none absolute inset-0 m-auto h-full w-full object-cover"
              />

              {/* Grille de composition discrète (Règle des tiers) */}
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 border border-white/20">
                <div className="border-r border-b border-white/15" />
                <div className="border-r border-b border-white/15" />
                <div className="border-b border-white/15" />
                <div className="border-r border-b border-white/15" />
                <div className="border-r border-b border-white/15" />
                <div className="border-b border-white/15" />
                <div className="border-r border-white/15" />
                <div className="border-r border-white/15" />
                <div />
              </div>

              {/* Repère central */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30">
                <div className="h-6 w-0.5 bg-ivory" />
                <div className="h-0.5 w-6 bg-ivory -ml-3" />
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar de réglages rapides */}
        <div className="border-t border-white/10 bg-obsidian/95 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Contrôle du Zoom */}
            <div className="flex items-center gap-3 flex-1 min-w-[240px]">
              <span className="text-[11px] font-medium tracking-wider uppercase text-stone">
                Zoom :
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(1, Number((z - 0.1).toFixed(1))))}
                aria-label="Dézoomer"
                className="flex h-8 w-8 items-center justify-center border border-white/20 bg-white/5 text-ivory hover:bg-white/10"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="h-1.5 flex-1 accent-ivory bg-white/20 rounded-lg cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(1))))}
                aria-label="Zoomer"
                className="flex h-8 w-8 items-center justify-center border border-white/20 bg-white/5 text-ivory hover:bg-white/10"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <span className="w-12 text-right font-mono text-xs text-stone">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Presets rapides de positionnement */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-stone">Alignement rapide :</span>
              <button
                type="button"
                onClick={alignTop}
                className="border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-ivory hover:border-ivory"
              >
                Haut (Yeux / Cils)
              </button>
              <button
                type="button"
                onClick={alignCenter}
                className="border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-ivory hover:border-ivory"
              >
                Centrer
              </button>
              <button
                type="button"
                onClick={alignBottom}
                className="border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-ivory hover:border-ivory"
              >
                Bas
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPosition({ x: 0, y: 0 });
                }}
                title="Réinitialiser"
                className="flex h-7 w-7 items-center justify-center border border-white/15 text-stone hover:text-ivory"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Boutons d'action finaux */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="min-h-[44px] border border-white/20 px-5 py-2 text-xs tracking-wider uppercase text-stone hover:border-ivory hover:text-ivory transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleValidateCrop}
              className="min-h-[44px] inline-flex items-center gap-2 border border-ivory bg-ivory px-6 py-2 text-xs font-semibold tracking-wider text-obsidian uppercase hover:bg-stone transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Envoi sur Cloudinary...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Valider et appliquer le recadrage</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
