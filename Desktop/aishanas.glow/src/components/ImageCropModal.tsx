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
} from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  fileName?: string;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob, croppedFileName: string) => Promise<void> | void;
  aspectRatio?: number;
}

type AspectPresetKey = 'original' | 'portrait_9_16' | 'portrait_4_5' | 'square' | 'landscape_16_10';

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
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');

  // Dynamic aspect ratio & natural dimensions
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [activeRatioKey, setActiveRatioKey] = useState<AspectPresetKey>('original');
  const [currentRatio, setCurrentRatio] = useState<number>(aspectRatio);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Measure natural dimensions and set initial ratio dynamically (default to natural / vertical format)
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setIsProcessing(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setNaturalSize({ width: w, height: h });
      if (w > 0 && h > 0) {
        const natRatio = w / h;
        // Default immediately to the image's original ratio to preserve vertical smartphone photos
        setCurrentRatio(natRatio);
        setActiveRatioKey('original');
        if (h > w) {
          setPreviewDevice('mobile');
        }
      }
    };
    img.src = imageSrc;
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

  // Ratio Presets
  const getPresetRatio = (key: AspectPresetKey): number => {
    if (key === 'original') {
      return naturalSize.width && naturalSize.height
        ? naturalSize.width / naturalSize.height
        : 1;
    }
    if (key === 'portrait_9_16') return 9 / 16;
    if (key === 'portrait_4_5') return 4 / 5;
    if (key === 'square') return 1;
    if (key === 'landscape_16_10') return 16 / 10;
    return 1;
  };

  const handleSelectRatio = (key: AspectPresetKey) => {
    setActiveRatioKey(key);
    setCurrentRatio(getPresetRatio(key));
    setPosition({ x: 0, y: 0 });
    setZoom(1);
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

      // Target canvas resolution (dynamic based on selected aspect ratio)
      let exportWidth = 1400;
      let exportHeight = Math.round(exportWidth / currentRatio);
      if (currentRatio < 1) {
        // Vertical photo (smartphone / portrait)
        exportHeight = 1600;
        exportWidth = Math.round(1600 * currentRatio);
      }

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
      const croppedFileName = `${cleanBaseName}-cadre.webp`;

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
                Cadrage &amp; Format du visuel
              </h3>
              <p className="text-[11px] text-stone/75">
                {naturalSize.width > 0 && naturalSize.height > 0
                  ? `Photo d’origine : ${naturalSize.width}×${naturalSize.height}px (${naturalSize.height > naturalSize.width ? 'Verticale' : 'Horizontale'})`
                  : 'Ajustez le format sans couper votre photo.'}
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

        {/* Ratio Selector Buttons Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/60 px-5 py-2.5 text-xs text-stone">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] tracking-wider uppercase text-stone/80 mr-1">
              Format de recadrage :
            </span>

            {[
              {
                key: 'original',
                label: '✨ Original',
                sub: naturalSize.width ? `${naturalSize.width}×${naturalSize.height}` : '100%',
              },
              { key: 'portrait_9_16', label: '📱 Story 9:16', sub: 'Vertical phone' },
              { key: 'portrait_4_5', label: '📸 Portrait 4:5', sub: 'Instagram' },
              { key: 'square', label: '⏹️ Carré 1:1', sub: 'Carré' },
              { key: 'landscape_16_10', label: '🖥️ Paysage 16:10', sub: 'Écran' },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handleSelectRatio(p.key as AspectPresetKey)}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] border transition-colors cursor-pointer ${
                  activeRatioKey === p.key
                    ? 'border-ivory bg-ivory text-obsidian font-bold'
                    : 'border-white/15 bg-white/5 text-stone hover:text-ivory hover:border-white/30'
                }`}
              >
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-stone/80">
            <Move className="h-3.5 w-3.5 text-stone" />
            <span>Glissez pour déplacer</span>
          </div>
        </div>

        {/* Viewport de recadrage interactif */}
        <div className="flex flex-1 items-center justify-center overflow-hidden bg-black/80 p-4 sm:p-6 min-h-[300px]">
          <div className="flex w-full items-center justify-center">
            {/* Fenêtre de cadrage avec ratio interactif et adaptation dynamique */}
            <div
              ref={containerRef}
              style={{
                aspectRatio: `${currentRatio}`,
                maxHeight: '52vh',
                maxWidth: currentRatio < 1 ? '340px' : (previewDevice === 'mobile' ? '340px' : previewDevice === 'tablet' ? '540px' : '680px'),
                width: '100%',
              }}
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
              className="relative overflow-hidden border-2 border-ivory/90 bg-obsidian cursor-grab active:cursor-grabbing select-none shadow-[0_0_40px_rgba(0,0,0,0.85)]"
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
                <div className="border-r border-b border-white/15" />
                <div className="border-r border-b border-white/15" />
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
                Haut
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
                  <span>Valider et appliquer le format</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
