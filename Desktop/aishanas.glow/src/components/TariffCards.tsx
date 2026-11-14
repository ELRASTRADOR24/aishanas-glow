import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudio } from '../context/StudioContext';
import type { BookingVariant, ServiceItem } from '../types/studio';
import { optimizeCloudinaryUrl } from '../utils/cloudinary';

interface TariffCardsProps {
  onSelectServiceForBooking?: (serviceId: string, variant: BookingVariant) => void;
}

export const TariffCards: React.FC<TariffCardsProps> = ({ onSelectServiceForBooking }) => {
  const { data } = useStudio();
  const navigate = useNavigate();
  const activeServices = data.services.filter((s) => s.active);
  const showAllServiceImages = data.config.showServiceImages !== false;

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

  const handleServiceSelect = (service: ServiceItem, variant: BookingVariant = 'full') => {
    if (onSelectServiceForBooking) {
      onSelectServiceForBooking(service.id, variant);
    }
    navigate(`/reserver?service=${encodeURIComponent(service.id)}&variant=${encodeURIComponent(variant)}`);
  };

  const extensions = activeServices.filter((s) => s.category === 'extensions');
  const deposes = activeServices.filter((s) => s.category === 'depose');
  const rehaussement = activeServices.filter((s) => s.category === 'rehaussement');
  const blanchiment = activeServices.filter((s) => s.category === 'blanchiment');

  const renderDescriptionSnippet = (service: ServiceItem) => {
    if (!service.description) return null;
    const isExpanded = expandedIds.has(service.id);
    const maxLength = 50;

    if (service.description.length <= maxLength) {
      return (
        <p className="mt-0.5 text-xs text-taupe leading-relaxed font-light">
          {service.description}
        </p>
      );
    }

    const snippet = service.description.slice(0, maxLength).trim();

    return (
      <p className="mt-0.5 text-xs text-taupe leading-relaxed font-light">
        {isExpanded ? (
          <span>
            {service.description}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleDetails(service.id);
              }}
              className="ml-1 inline-block font-bold text-charcoal hover:opacity-70 cursor-pointer tracking-widest"
              title="Réduire"
            >
              ...
            </button>
          </span>
        ) : (
          <span>
            {snippet}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleDetails(service.id);
              }}
              className="ml-0.5 inline-block font-bold text-charcoal hover:opacity-70 cursor-pointer tracking-widest"
              title="Afficher la suite"
            >
              ...
            </button>
          </span>
        )}
      </p>
    );
  };

  return (
    <section
      id="tarifs"
      aria-labelledby="tarifs-heading"
      className="surface-paper border-b border-stone/70 px-4 py-14 sm:px-6 sm:py-20"
    >
      <div className="mx-auto max-w-3xl">
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
            Cliquez sur une prestation pour réserver votre créneau sur la page de réservation.
          </p>
        </div>

        {/* Feuille tarifaire éditoriale unique — Design plat, sans encadrements superflus */}
        <div className="border border-charcoal/15 bg-white px-5 py-8 shadow-[0_24px_60px_-30px_rgba(20,19,17,0.14)] sm:px-12 sm:py-12">
          {/* SECTION 1 : EXTENSIONS DE CILS */}
          <div>
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-charcoal/15 pb-3">
              <h3 className="editorial-underline font-serif text-2xl text-charcoal sm:text-3xl">
                Extensions de cils :
              </h3>
              <div className="text-right text-[11px] leading-tight text-taupe">
                <p className="font-medium text-charcoal">Remplissage 3 semaines</p>
                <p>Pas de remplissages successifs possibles</p>
              </div>
            </div>

            <div className="mt-3 hidden grid-cols-[1fr_auto_auto] gap-6 border-b border-stone/40 pb-2 text-[11px] font-medium tracking-widest text-taupe uppercase sm:grid">
              <span>Prestation</span>
              <span className="w-24 text-right">Pose</span>
              <span className="w-24 text-right">Remplissage</span>
            </div>

            <ul className="divide-y divide-stone/40">
              {extensions.map((service) => (
                <li
                  key={service.id}
                  onClick={() => handleServiceSelect(service, 'full')}
                  className="group py-4 transition-colors hover:bg-ivory/50 cursor-pointer -mx-3 px-3 sm:-mx-4 sm:px-4"
                >
                  <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6">
                    <div className="flex items-start gap-3.5 sm:items-center">
                      {shouldShowImage(service) && service.imageUrl ? (
                        <img
                          src={optimizeCloudinaryUrl(service.imageUrl, 180)}
                          alt={service.name}
                          width={64}
                          height={64}
                          className="h-14 w-14 shrink-0 border border-stone/70 bg-paper object-cover sm:h-16 sm:w-16"
                        />
                      ) : null}
                      <div>
                        <p className="font-serif text-xl text-charcoal sm:text-2xl group-hover:text-charcoal/90">
                          {service.name}
                        </p>
                        {renderDescriptionSnippet(service)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:contents">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleServiceSelect(service, 'full');
                        }}
                        className="flex min-h-[44px] flex-1 items-center justify-between border border-stone/70 px-3 py-2 text-left transition-colors hover:border-charcoal hover:bg-ivory sm:w-24 sm:flex-none sm:justify-end sm:border-0 sm:px-2 cursor-pointer"
                        aria-label={`Réserver ${service.name} en pose complète`}
                      >
                        <span className="text-[11px] text-taupe uppercase sm:hidden">Pose</span>
                        <span className="font-serif text-2xl text-charcoal">
                          {service.fullPrice}€
                        </span>
                      </button>

                      {service.refillPrice != null ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleServiceSelect(service, 'refill');
                          }}
                          className="flex min-h-[44px] flex-1 items-center justify-between border border-stone/70 px-3 py-2 text-left transition-colors hover:border-charcoal hover:bg-ivory sm:w-24 sm:flex-none sm:justify-end sm:border-0 sm:px-2 cursor-pointer"
                          aria-label={`Réserver ${service.name} en remplissage`}
                        >
                          <span className="text-[11px] text-taupe uppercase sm:hidden">
                            Rempl.
                          </span>
                          <span className="font-serif text-2xl text-charcoal">
                            {service.refillPrice}€
                          </span>
                        </button>
                      ) : (
                        <span className="hidden w-24 text-right text-xs text-taupe sm:inline-block">
                          —
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-3 border-l-2 border-charcoal/40 pl-3 text-xs text-taupe italic">
              Pose en cils marrons et cils pailletés / déco cils disponibles sur demande lors de la
              réservation.
            </p>
          </div>

          {/* SECTION 2 : DÉPOSES */}
          {deposes.length > 0 && (
            <div className="mt-9 border-t border-charcoal/15 pt-7">
              <div className="border-b border-charcoal/15 pb-3 mb-4">
                <h3 className="editorial-underline font-serif text-2xl text-charcoal sm:text-3xl">
                  Déposes :
                </h3>
              </div>

              {/* Règle Dépose offerte uniquement si repose */}
              <div className="mb-4 rounded-none border-l-2 border-charcoal bg-ivory/60 p-3 text-xs text-taupe">
                <strong className="text-charcoal font-semibold">Important :</strong> Le retrait de vos cils est{' '}
                <strong>gratuit uniquement si vous refaites une nouvelle pose de cils juste après</strong> (option à cocher lors de votre réservation de pose). La dépose seule sans nouvelle pose reste à 10€ (studio) / 15€ (extérieur).
              </div>

              <ul className="space-y-3">
                {deposes.map((service) => (
                  <li
                    key={service.id}
                    onClick={() => handleServiceSelect(service, 'standard')}
                    className="group flex items-center justify-between gap-4 border-b border-stone/30 pb-3 hover:bg-ivory/50 transition-colors cursor-pointer -mx-3 px-3 sm:-mx-4 sm:px-4"
                  >
                    <div className="flex items-center gap-3.5">
                      {shouldShowImage(service) && service.imageUrl ? (
                        <img
                          src={optimizeCloudinaryUrl(service.imageUrl, 160)}
                          alt={service.name}
                          width={56}
                          height={56}
                          className="h-12 w-12 shrink-0 border border-stone/70 bg-paper object-cover sm:h-14 sm:w-14"
                        />
                      ) : null}
                      <div>
                        <p className="font-serif text-xl text-charcoal group-hover:text-charcoal/90">
                          {service.name}
                        </p>
                        {renderDescriptionSnippet(service)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleServiceSelect(service, 'standard');
                      }}
                      className="min-h-[44px] shrink-0 px-2 font-serif text-2xl text-charcoal underline-offset-4 hover:underline cursor-pointer"
                    >
                      {service.fullPrice}€
                    </button>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-4 pt-1">
                  <div>
                    <p className="font-serif text-xl text-charcoal">Dépose → repose</p>
                    <p className="text-xs text-taupe">
                      Gratuit si vous effectuez une dépose suivie immédiatement d’une nouvelle pose.
                    </p>
                  </div>
                  <span className="font-serif text-xl font-medium text-charcoal">Gratuit</span>
                </li>
              </ul>
            </div>
          )}

          {/* SECTION 3 : REHAUSSEMENT DE CILS */}
          {rehaussement.length > 0 && (
            <div className="mt-9 border-t border-charcoal/25 pt-7">
              <div className="border-b border-charcoal/15 pb-3 mb-4">
                <h3 className="editorial-underline font-serif text-2xl text-charcoal sm:text-3xl">
                  Rehaussement de cils :
                </h3>
              </div>

              <ul className="space-y-4">
                {rehaussement.map((service) => (
                  <li
                    key={service.id}
                    onClick={() => handleServiceSelect(service, 'full')}
                    className="group py-3 border-b border-stone/30 last:border-b-0 hover:bg-ivory/50 transition-colors cursor-pointer -mx-3 px-3 sm:-mx-4 sm:px-4"
                  >
                    <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6">
                      <div className="flex items-start gap-3.5 sm:items-center">
                        {shouldShowImage(service) && service.imageUrl ? (
                          <img
                            src={optimizeCloudinaryUrl(service.imageUrl, 180)}
                            alt={service.name}
                            width={64}
                            height={64}
                            className="h-14 w-14 shrink-0 border border-stone/70 bg-paper object-cover sm:h-16 sm:w-16"
                          />
                        ) : null}
                        <div>
                          <h4 className="editorial-underline font-serif text-2xl text-charcoal group-hover:text-charcoal/90">
                            {service.name}
                          </h4>
                          {renderDescriptionSnippet(service)}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:contents">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleServiceSelect(service, 'full');
                          }}
                          className="flex min-h-[44px] flex-1 items-center justify-between border border-stone/70 px-3 py-2 transition-colors hover:border-charcoal hover:bg-ivory sm:w-24 sm:flex-none sm:flex-col sm:items-end sm:border-0 sm:px-2 cursor-pointer"
                        >
                          <span className="text-[10px] tracking-wider text-taupe uppercase">
                            Seul
                          </span>
                          <span className="font-serif text-2xl text-charcoal">
                            {service.fullPrice}€
                          </span>
                        </button>

                        {service.refillPrice != null && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleServiceSelect(service, 'tint');
                            }}
                            className="flex min-h-[44px] flex-1 items-center justify-between border border-stone/70 px-3 py-2 transition-colors hover:border-charcoal hover:bg-ivory sm:w-28 sm:flex-none sm:flex-col sm:items-end sm:border-0 sm:px-2 cursor-pointer"
                          >
                            <span className="text-[10px] tracking-wider text-taupe uppercase">
                              Avec teinture
                            </span>
                            <span className="font-serif text-2xl text-charcoal">
                              {service.refillPrice}€
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* SECTION 4 : BLANCHIMENT DENTAIRE */}
          {blanchiment.length > 0 && (
            <div className="mt-9 border-t-2 border-charcoal pt-7">
              <div className="border-b border-charcoal/15 pb-3 mb-4">
                <h3 className="font-serif text-2xl text-charcoal italic sm:text-3xl">
                  Blanchiment dentaire :
                </h3>
              </div>

              <ul className="divide-y divide-stone/40">
                {blanchiment.map((service) => (
                  <li
                    key={service.id}
                    onClick={() => handleServiceSelect(service, 'standard')}
                    className="group flex items-center justify-between gap-4 py-3.5 hover:bg-ivory/50 transition-colors cursor-pointer -mx-3 px-3 sm:-mx-4 sm:px-4"
                  >
                    <div className="flex items-start gap-3.5 sm:items-center">
                      {shouldShowImage(service) && service.imageUrl ? (
                        <img
                          src={optimizeCloudinaryUrl(service.imageUrl, 180)}
                          alt={service.name}
                          width={64}
                          height={64}
                          className="h-14 w-14 shrink-0 border border-stone/70 bg-paper object-cover sm:h-16 sm:w-16"
                        />
                      ) : null}
                      <div>
                        <p className="font-serif text-xl text-charcoal italic sm:text-2xl group-hover:text-charcoal/90">
                          {service.name}
                        </p>
                        {renderDescriptionSnippet(service)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleServiceSelect(service, 'standard');
                      }}
                      className="min-h-[44px] shrink-0 px-2 font-serif text-2xl text-charcoal underline-offset-4 hover:underline cursor-pointer"
                    >
                      {service.fullPrice}€
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* NOTE DISPONIBILITÉS */}
          <div className="mt-9 border-t border-stone/70 bg-ivory/70 p-4 text-center text-xs leading-relaxed text-charcoal/85 sm:p-5">
            <p className="font-medium tracking-wide uppercase">
              Créneaux flexibles — Disponibilités &amp; Supplément
            </p>
            <p className="mt-1.5 text-taupe">{data.config.bookingRules.supplementNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
};
