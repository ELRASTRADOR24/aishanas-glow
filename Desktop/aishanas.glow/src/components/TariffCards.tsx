import React, { useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import type { BookingVariant, ServiceCategory, ServiceItem } from '../types/studio';
import { optimizeCloudinaryUrl } from '../utils/cloudinary';

interface TariffCardsProps {
  onSelectServiceForBooking: (serviceId: string, variant: BookingVariant) => void;
}

const CATEGORIES = [
  { id: 'ALL', label: 'Toutes les prestations' },
  { id: 'extensions', label: 'Extensions de cils' },
  { id: 'depose', label: 'Déposes' },
  { id: 'rehaussement', label: 'Rehaussement' },
  { id: 'blanchiment', label: 'Blanchiment dentaire' },
];

const CATEGORY_NAMES: Record<ServiceCategory, string> = {
  extensions: 'Extensions',
  depose: 'Dépose',
  rehaussement: 'Rehaussement',
  blanchiment: 'Blanchiment',
};

export const TariffCards: React.FC<TariffCardsProps> = ({ onSelectServiceForBooking }) => {
  const { data } = useStudio();
  const activeServices = data.services.filter((s) => s.active);
  const showAllServiceImages = data.config.showServiceImages !== false;

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleDetails = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const shouldShowImage = (service: ServiceItem) =>
    showAllServiceImages && service.showImage !== false && Boolean(service.imageUrl);

  const handleBookClick = (service: ServiceItem, variant: BookingVariant) => {
    onSelectServiceForBooking(service.id, variant);
    const target = document.getElementById('reservation');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const filteredServices = activeServices.filter((service) => {
    if (selectedCategory === 'ALL') return true;
    return service.category === selectedCategory;
  });

  const renderDescription = (service: ServiceItem) => {
    if (!service.description) return null;
    const isExpanded = expandedIds.has(service.id);
    const maxLength = 58;

    if (service.description.length <= maxLength) {
      return (
        <p className="mt-1 text-xs text-taupe leading-relaxed font-light">
          {service.description}
        </p>
      );
    }

    const snippet = service.description.slice(0, maxLength).trim();

    return (
      <p className="mt-1 text-xs text-taupe leading-relaxed font-light">
        {isExpanded ? service.description : `${snippet}...`}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleDetails(service.id);
          }}
          className="ml-1.5 font-medium text-charcoal underline underline-offset-2 hover:text-taupe cursor-pointer"
        >
          {isExpanded ? 'voir moins' : 'voir plus'}
        </button>
      </p>
    );
  };

  return (
    <section
      id="tarifs"
      aria-labelledby="tarifs-heading"
      className="surface-paper border-b border-stone/70 px-4 py-14 sm:px-6 sm:py-20"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <img
            src="/logo-eyes-dark.png"
            alt=""
            width={659}
            height={226}
            loading="lazy"
            className="mx-auto mb-3 h-auto w-24 opacity-90 sm:w-28"
          />
          <p className="text-[11px] font-medium tracking-[0.24em] text-taupe uppercase">
            Carte des prestations
          </p>
          <h2 id="tarifs-heading" className="mt-2 font-serif text-3xl text-charcoal sm:text-5xl">
            {data.config.brandName}
          </h2>
          <p className="mt-2 text-xs tracking-wide text-taupe sm:text-sm">
            Choisissez directement votre prestation et formule pour réserver votre créneau.
          </p>
        </div>

        {/* Category Filter Tabs (style YDM adapté Alshana's Glow) */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          {CATEGORIES.map((cat) => {
            const count =
              cat.id === 'ALL'
                ? activeServices.length
                : activeServices.filter((s) => s.category === cat.id).length;
            const isActive = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`min-h-[42px] rounded-full px-4 py-2 text-xs font-medium tracking-wide transition-all cursor-pointer ${
                  isActive
                    ? 'bg-charcoal text-paper shadow-xs font-semibold'
                    : 'bg-white text-taupe border border-stone/60 hover:border-charcoal hover:text-charcoal'
                }`}
              >
                <span>{cat.label}</span>
                <span className="ml-1.5 text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Note Dépose offerte pour dépose+repose */}
        {(selectedCategory === 'ALL' || selectedCategory === 'depose' || selectedCategory === 'extensions') && (
          <div className="mb-8 rounded-2xl border border-stone/50 bg-white/70 p-4 text-xs text-taupe shadow-2xs sm:flex sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-charcoal shrink-0" />
              <span>
                <strong className="text-charcoal font-semibold">Règle de dépose :</strong>{' '}
                Le retrait de vos cils est <strong>gratuit uniquement si vous refaites une pose de cils juste après</strong> (option à cocher lors de votre réservation). En revanche, la dépose seule sans nouvelle pose reste à 10€ (studio) ou 15€ (extérieur).
              </span>
            </div>
            <span className="mt-2 inline-block font-serif text-sm font-bold text-charcoal sm:mt-0 whitespace-nowrap">
              Gratuit si repose
            </span>
          </div>
        )}

        {/* Grid of Service Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service) => {
            const hasRefill = service.refillPrice != null;
            const minPrice = service.fullPrice;

            return (
              <div
                key={service.id}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-stone/70 bg-white shadow-xs transition-all duration-300 hover:border-charcoal/50 hover:shadow-lg"
              >
                <div>
                  {/* Image / Visuel */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-ivory">
                    {shouldShowImage(service) && service.imageUrl ? (
                      <img
                        src={optimizeCloudinaryUrl(service.imageUrl, 400)}
                        alt={service.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-taupe">
                        <Sparkles className="h-6 w-6 opacity-40 mb-1" />
                        <span className="text-[10px] uppercase tracking-widest font-medium">
                          Alshana's Glow
                        </span>
                      </div>
                    )}

                    {/* Badge Catégorie en haut à gauche */}
                    <div className="absolute top-3 left-3 z-10">
                      <span className="rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-charcoal uppercase shadow-xs border border-stone/40 backdrop-blur-md">
                        {CATEGORY_NAMES[service.category] || service.category}
                      </span>
                    </div>

                    {/* Badge Prix en bas à droite */}
                    <div className="absolute bottom-3 right-3 z-10 rounded-xl border border-stone/40 bg-charcoal/90 px-3 py-1 text-right text-ivory shadow-xs backdrop-blur-md">
                      <div className="text-[9px] uppercase tracking-wider text-stone/80">
                        {hasRefill ? 'Dès' : 'Tarif'}
                      </div>
                      <div className="font-serif text-base font-bold leading-tight">
                        {minPrice}€
                      </div>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5">
                    <h3 className="font-serif text-xl font-medium text-charcoal transition-colors group-hover:text-charcoal/90">
                      {service.name}
                    </h3>

                    {service.subtitle && (
                      <p className="mt-0.5 text-xs font-medium text-taupe/80">
                        {service.subtitle}
                      </p>
                    )}

                    {/* Description avec extrait et ... voir plus */}
                    {renderDescription(service)}

                    {service.note && (
                      <p className="mt-2 text-[11px] text-taupe/90 italic">
                        {service.note}
                      </p>
                    )}
                  </div>
                </div>

                {/* Variant Options Selection (Boutons de choix directs) */}
                <div className="border-t border-stone/40 bg-ivory/40 p-4">
                  {service.category === 'extensions' && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-medium tracking-wider text-taupe uppercase">
                        Choisir une formule :
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleBookClick(service, 'full')}
                          className="flex min-h-[44px] flex-col items-center justify-center rounded-xl border border-stone/70 bg-white px-2 py-1.5 text-center transition-colors hover:border-charcoal hover:bg-paper cursor-pointer"
                        >
                          <span className="text-[10px] uppercase text-taupe">Pose complète</span>
                          <span className="font-serif text-base font-bold text-charcoal">
                            {service.fullPrice}€
                          </span>
                        </button>

                        {service.refillPrice != null ? (
                          <button
                            type="button"
                            onClick={() => handleBookClick(service, 'refill')}
                            className="flex min-h-[44px] flex-col items-center justify-center rounded-xl border border-stone/70 bg-white px-2 py-1.5 text-center transition-colors hover:border-charcoal hover:bg-paper cursor-pointer"
                          >
                            <span className="text-[10px] uppercase text-taupe">Rempl. 3 sem.</span>
                            <span className="font-serif text-base font-bold text-charcoal">
                              {service.refillPrice}€
                            </span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {service.category === 'rehaussement' && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-medium tracking-wider text-taupe uppercase">
                        Choisir une formule :
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleBookClick(service, 'full')}
                          className="flex min-h-[44px] flex-col items-center justify-center rounded-xl border border-stone/70 bg-white px-2 py-1.5 text-center transition-colors hover:border-charcoal hover:bg-paper cursor-pointer"
                        >
                          <span className="text-[10px] uppercase text-taupe">Sans teinture</span>
                          <span className="font-serif text-base font-bold text-charcoal">
                            {service.fullPrice}€
                          </span>
                        </button>

                        {service.refillPrice != null ? (
                          <button
                            type="button"
                            onClick={() => handleBookClick(service, 'tint')}
                            className="flex min-h-[44px] flex-col items-center justify-center rounded-xl border border-stone/70 bg-white px-2 py-1.5 text-center transition-colors hover:border-charcoal hover:bg-paper cursor-pointer"
                          >
                            <span className="text-[10px] uppercase text-taupe">Avec teinture</span>
                            <span className="font-serif text-base font-bold text-charcoal">
                              {service.refillPrice}€
                            </span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {service.category === 'depose' && (
                    <button
                      type="button"
                      onClick={() => handleBookClick(service, 'standard')}
                      className="flex min-h-[44px] w-full items-center justify-between rounded-xl bg-charcoal px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-paper transition-all hover:bg-charcoal/90 cursor-pointer shadow-xs"
                    >
                      <span>Réserver cette dépose</span>
                      <span className="flex items-center gap-1 font-serif text-sm font-bold text-ivory">
                        {service.fullPrice}€
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                  )}

                  {service.category === 'blanchiment' && (
                    <button
                      type="button"
                      onClick={() => handleBookClick(service, 'standard')}
                      className="flex min-h-[44px] w-full items-center justify-between rounded-xl bg-charcoal px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-paper transition-all hover:bg-charcoal/90 cursor-pointer shadow-xs"
                    >
                      <span>Réserver cette séance</span>
                      <span className="flex items-center gap-1 font-serif text-sm font-bold text-ivory">
                        {service.fullPrice}€
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Note créneaux & suppléments en bas */}
        <div className="mt-12 rounded-2xl border border-stone/70 bg-ivory/70 p-5 text-center text-xs leading-relaxed text-charcoal/85 sm:p-6">
          <p className="font-medium tracking-wide uppercase">
            Créneaux flexibles — Disponibilités &amp; Supplément
          </p>
          <p className="mt-1.5 text-taupe">{data.config.bookingRules.supplementNote}</p>
        </div>
      </div>
    </section>
  );
};
