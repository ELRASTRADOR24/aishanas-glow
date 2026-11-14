import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import type { BookingVariant, ServiceCategory, ServiceItem } from '../types/studio';
import { AestheticMediaViewer } from './AestheticMediaViewer';

interface TariffCardsProps {
  onSelectServiceForBooking?: (serviceId: string, variant: BookingVariant) => void;
}

const CATEGORY_NAMES: Record<ServiceCategory, string> = {
  extensions: 'Extensions',
  depose: 'Dépose',
  rehaussement: 'Rehaussement',
  blanchiment: 'Blanchiment',
};

export const TariffCards: React.FC<TariffCardsProps> = ({ onSelectServiceForBooking }) => {
  const { data } = useStudio();
  const navigate = useNavigate();
  const activeServices = data.services.filter((s) => s.active);
  const showAllServiceImages = data.config.showServiceImages !== false;

  const shouldShowImage = (service: ServiceItem) =>
    showAllServiceImages && service.showImage !== false && Boolean(service.imageUrl);

  const handleBookClick = (service: ServiceItem, variant: BookingVariant = 'full') => {
    if (onSelectServiceForBooking) {
      onSelectServiceForBooking(service.id, variant);
    }
    navigate(`/reserver?service=${encodeURIComponent(service.id)}&variant=${encodeURIComponent(variant)}`);
  };

  return (
    <section
      id="tarifs"
      aria-labelledby="tarifs-heading"
      className="surface-paper scroll-mt-20 border-b border-stone/70 px-4 py-14 sm:px-6 sm:py-20"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header minimaliste */}
        <div className="mb-12 text-center">
          <p className="text-[10px] font-medium tracking-[0.28em] text-taupe uppercase">
            {data.config.tarifsCategoryBadge || 'Menu du Studio'}
          </p>
          <h2 id="tarifs-heading" className="mt-2 font-serif text-3xl text-charcoal sm:text-5xl font-normal">
            {data.config.tarifsTitle || 'Prestations & Tarifs'}
          </h2>
          <p className="mt-2 text-xs tracking-wide text-taupe sm:text-sm">
            {data.config.tarifsSubtitle || 'Cliquez sur une prestation pour choisir votre créneau.'}
          </p>
        </div>

        {/* Grille de cartes épurées — Bords carrés, ultra-propres et luxueuses */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {activeServices.map((service) => {
            const defaultVariant: BookingVariant =
              service.category === 'depose' || service.category === 'blanchiment'
                ? 'standard'
                : 'full';

            return (
              <div
                key={service.id}
                onClick={() => handleBookClick(service, defaultVariant)}
                className="group flex flex-col justify-between border border-charcoal/15 bg-white transition-all duration-300 hover:border-charcoal hover:shadow-[0_16px_36px_-18px_rgba(20,19,17,0.18)] cursor-pointer"
              >
                <div>
                  {shouldShowImage(service) && service.imageUrl ? (
                    <AestheticMediaViewer
                      url={service.imageUrl}
                      alt={service.name}
                      badge={CATEGORY_NAMES[service.category] || service.category}
                      aspectRatioClass="aspect-[16/10]"
                      allowExpand={true}
                    />
                  ) : (
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-ivory border-b border-charcoal/10 flex flex-col items-center justify-center p-6 text-center text-taupe">
                      <Sparkles className="h-6 w-6 opacity-40 mb-1" />
                      <span className="text-[10px] uppercase tracking-widest font-medium">
                        Alshana's Glow
                      </span>
                      <div className="absolute top-3 left-3 z-10">
                        <span className="border border-charcoal/20 bg-white/95 px-2.5 py-0.5 text-[10px] font-medium tracking-widest text-charcoal uppercase">
                          {CATEGORY_NAMES[service.category] || service.category}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Contenu sobre : Titre, sous-titre, durée & prix */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-serif text-xl font-medium text-charcoal transition-colors group-hover:text-charcoal/90">
                          {service.name}
                        </h3>
                        {service.subtitle && (
                          <p className="mt-1 text-xs text-taupe">
                            {service.subtitle}
                          </p>
                        )}
                        <div className="mt-2.5 flex items-center gap-2">
                          <span className="inline-flex items-center border border-charcoal/10 bg-ivory/60 px-2.5 py-0.5 text-[10px] font-medium tracking-wider text-charcoal uppercase">
                            Durée : 2h
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-serif text-2xl font-normal text-charcoal">
                          {service.fullPrice}€
                        </span>
                        {service.refillPrice != null && (
                          <span className="block text-[10px] text-taupe uppercase tracking-wider">
                            Rempl. {service.refillPrice}€
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bouton d'action direct & minimaliste */}
                <div className="border-t border-charcoal/10 px-5 py-3.5 bg-ivory/20 flex items-center justify-between transition-colors group-hover:bg-charcoal group-hover:text-ivory">
                  <span className="text-[11px] font-medium tracking-widest uppercase">
                    Réserver ce soin
                  </span>
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Note sobre vers la FAQ */}
        <div className="mt-10 text-center text-xs text-taupe">
          <span>Déposes gratuites avec nouvelle pose, délais de remplissage et créneaux flexibles : </span>
          <a
            href="#faq"
            className="font-medium text-charcoal underline underline-offset-4 hover:opacity-70 transition-opacity"
          >
            consulter les questions fréquentes (FAQ)
          </a>
        </div>
      </div>
    </section>
  );
};
