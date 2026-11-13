import React from 'react';
import type { ServiceItem, BookingVariant } from '../types/studio';
import { optimizeCloudinaryUrl } from '../utils/cloudinary';

interface ServiceCardProps {
  service: ServiceItem;
  shouldShowImage: boolean;
  handleBookClick: (service: ServiceItem, variant: BookingVariant) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, shouldShowImage, handleBookClick }) => {
  const [showDesc, setShowDesc] = React.useState(false);
  const shortSummary = service.description ? service.description.split(' ').slice(0,6).join(' ') + (service.description.split(' ').length > 6 ? '…' : '') : '';

  return (
    <div className="border border-charcoal/15 bg-white p-4 shadow-sm rounded-lg flex flex-col items-start cursor-pointer" onClick={() => handleBookClick(service, 'full')}>
      {shouldShowImage && service.imageUrl && (
        <img
          src={optimizeCloudinaryUrl(service.imageUrl, 180)}
          alt={service.name}
          width={80}
          height={80}
          className="mb-3 h-20 w-20 rounded object-cover"
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
