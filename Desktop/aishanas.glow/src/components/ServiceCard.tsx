import React from 'react';
import type { ServiceItem, BookingVariant } from '../types/studio';
import { isVideoUrl, optimizeCloudinaryUrl } from '../utils/cloudinary';

const SERVICE_DEFAULT_ILLUSTRATIONS: Record<string, string> = {
  'ext-cil-a-cil': '/srv-cil-a-cil.jpg',
  'ext-pose-mixte': '/srv-pose-mixte.jpg',
  'ext-volume-leger': '/srv-volume-leger.jpg',
  'ext-volume-russe': '/srv-volume-russe.jpg',
  'ext-whispy-manga': '/srv-whispy-manga.jpg',
  'dep-alshana': '/srv-depose-studio.jpg',
  'dep-exterieur': '/srv-depose-exterieur.jpg',
  'reh-cils': '/srv-rehaussement.jpg',
  'bla-ultra-white-1': '/srv-blanchiment-1.jpg',
  'bla-ultra-white-2': '/srv-blanchiment-2.jpg',
};

interface ServiceCardProps {
  service: ServiceItem;
  shouldShowImage: boolean;
  handleBookClick: (service: ServiceItem, variant: BookingVariant) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, shouldShowImage, handleBookClick }) => {
  const [showDesc, setShowDesc] = React.useState(false);
  const shortSummary = service.description ? service.description.split(' ').slice(0,6).join(' ') + (service.description.split(' ').length > 6 ? '…' : '') : '';

  const fallback = SERVICE_DEFAULT_ILLUSTRATIONS[service.id] || '/srv-pose-mixte.jpg';
  const isVid = isVideoUrl(service.imageUrl);
  const imgSrc = (!service.imageUrl || isVid)
    ? fallback
    : optimizeCloudinaryUrl(service.imageUrl, 180);

  return (
    <div className="border border-charcoal/15 bg-white p-4 shadow-sm rounded-lg flex flex-col items-start cursor-pointer" onClick={() => handleBookClick(service, 'full')}>
      {shouldShowImage && (
        <img
          src={imgSrc}
          alt={service.name}
          width={80}
          height={80}
          onError={(e) => {
            if (e.currentTarget.src !== fallback) {
              e.currentTarget.src = fallback;
            }
          }}
          className="mb-3 h-20 w-20 rounded object-cover bg-ivory"
        />
      )}
      <p className="font-serif text-xl text-charcoal">{service.name}</p>
      {/* Info button to toggle description */}
      <button
        type="button"
        className="mt-1 text-sm text-blue-600 underline"
        onClick={(e) => { e.stopPropagation(); setShowDesc(!showDesc); }}
      >
        {showDesc ? 'Masquer' : 'Info'}
      </button>
      {showDesc && (
        <p className="mt-1 text-sm text-taupe">{shortSummary}</p>
      )}
      <div className="mt-3 flex gap-2 w-full">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleBookClick(service, 'full'); }}
          className="flex-1 min-h-[44px] border border-stone/70 px-3 py-2 text-left hover:border-charcoal hover:bg-ivory"
        >
          <span className="text-[11px] text-taupe uppercase">Pose</span>{' '}
          <span className="font-serif text-2xl text-charcoal">{service.fullPrice}€</span>
        </button>
        {service.refillPrice != null && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleBookClick(service, 'refill'); }}
            className="flex-1 min-h-[44px] border border-stone/70 px-3 py-2 text-left hover:border-charcoal hover:bg-ivory"
          >
            <span className="text-[11px] text-taupe uppercase">Rempl.</span>{' '}
            <span className="font-serif text-2xl text-charcoal">{service.refillPrice}€</span>
          </button>
        )}
      </div>
    </div>
  );
};
