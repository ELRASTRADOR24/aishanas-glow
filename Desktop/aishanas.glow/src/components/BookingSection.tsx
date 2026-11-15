import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Copy, ShieldCheck } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import type { BookingRequest, BookingVariant, ServiceCategory } from '../types/studio';
import {
  buildBookingClipboardSummary,
  calculateBookingTotal,
  formatFrenchDate,
  getDayAvailability,
} from '../utils/bookingLogic';
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

interface BookingSectionProps {
  preselectedServiceId: string | null;
  preselectedVariant: BookingVariant | null;
  selectionTick: number;
}

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  extensions: 'Extensions de cils',
  rehaussement: 'Rehaussement de cils',
  blanchiment: 'Blanchiment dentaire',
  depose: 'Dépose',
};

export const BookingSection: React.FC<BookingSectionProps> = ({
  preselectedServiceId,
  preselectedVariant,
  selectionTick,
}) => {
  const { data, submitBooking } = useStudio();
  const activeServices = data.services.filter((s) => s.active);
  const activeAddons = data.addons.filter((a) => a.active);
  const { bookingRules } = data.config;

  // Wizard Step: 1 = Prestation/Formule, 2 = Date & Heure, 3 = Coordonnées & Confirmation
  const [currentStep, setCurrentStep] = useState<number>(1);

  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>('extensions');
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    activeServices[0]?.id || ''
  );
  const [variant, setVariant] = useState<BookingVariant>('full');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [preferredDate, setPreferredDate] = useState<string>(tomorrow);
  const [preferredTime, setPreferredTime] = useState<string>(
    bookingRules.flexibleHours !== false
      ? '14:00'
      : bookingRules.standardSlots[1] || bookingRules.standardSlots[0] || '14:00'
  );

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientInstagram, setClientInstagram] = useState('');
  const [notes, setNotes] = useState('');
  const [contraindicationsConfirmed, setContraindicationsConfirmed] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingRequest | null>(null);
  const [copied, setCopied] = useState(false);

  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (!preselectedServiceId) return;
    const found = activeServices.find((s) => s.id === preselectedServiceId);
    if (found) {
      setSelectedCategory(found.category);
      setSelectedServiceId(found.id);
      if (preselectedVariant) {
        setVariant(preselectedVariant);
      } else {
        setVariant(
          found.category === 'depose' || found.category === 'blanchiment' ? 'standard' : 'full'
        );
      }
      setSelectedAddonIds([]);
      setContraindicationsConfirmed(false);
      setCurrentStep(1);
    }
  }, [preselectedServiceId, preselectedVariant, selectionTick]);

  const currentService = useMemo(
    () => activeServices.find((s) => s.id === selectedServiceId) || activeServices[0],
    [activeServices, selectedServiceId]
  );

  const categoryServices = useMemo(
    () => activeServices.filter((s) => s.category === selectedCategory),
    [activeServices, selectedCategory]
  );

  const dayAvailability = useMemo(
    () =>
      getDayAvailability(
        preferredDate,
        bookingRules,
        data.occupiedSlots,
        currentService?.category === 'extensions' ? 120 : currentService?.durationMinutes || 120
      ),
    [preferredDate, bookingRules, data.occupiedSlots, currentService]
  );

  useEffect(() => {
    if (dayAvailability.flexibleHours) {
      if (!/^\d{2}:\d{2}$/.test(preferredTime)) {
        setPreferredTime('14:00');
      }
      return;
    }
    const firstAvailable = dayAvailability.slots.find((s) => s.available);
    const currentStillAvailable = dayAvailability.slots.some(
      (s) => s.time === preferredTime && s.available
    );
    if (!currentStillAvailable && firstAvailable) {
      setPreferredTime(firstAvailable.time);
    }
  }, [dayAvailability, preferredTime]);

  const availableAddons = useMemo(
    () =>
      activeAddons.filter(
        (addon) => currentService && addon.applicableCategories.includes(currentService.category)
      ),
    [activeAddons, currentService]
  );

  const chosenAddons = useMemo(
    () => availableAddons.filter((a) => selectedAddonIds.includes(a.id)),
    [availableAddons, selectedAddonIds]
  );

  const pricing = useMemo(() => {
    if (!currentService) return null;
    return calculateBookingTotal(
      currentService,
      variant,
      chosenAddons,
      preferredDate,
      preferredTime,
      bookingRules
    );
  }, [currentService, variant, chosenAddons, preferredDate, preferredTime, bookingRules]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const isOutside = (e: PointerEvent) => {
      const rect = dialog.getBoundingClientRect();
      return (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
    };
    let pressedOutside = false;
    const onDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
    };
    dialog.addEventListener('pointerdown', onDown);
    dialog.addEventListener('pointerup', onUp);
    return () => {
      dialog.removeEventListener('pointerdown', onDown);
      dialog.removeEventListener('pointerup', onUp);
    };
  }, [confirmedBooking]);

  const handleCategoryChange = (cat: ServiceCategory) => {
    setSelectedCategory(cat);
    const firstInCat = activeServices.find((s) => s.category === cat);
    if (firstInCat) {
      setSelectedServiceId(firstInCat.id);
      setVariant(cat === 'depose' || cat === 'blanchiment' ? 'standard' : 'full');
    }
    setSelectedAddonIds([]);
    setErrorMessage('');
  };

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Step Navigation Handlers
  const goToNextStep = () => {
    setErrorMessage('');
    if (currentStep === 1) {
      if (!currentService) {
        setErrorMessage('Veuillez choisir une prestation.');
        return;
      }
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (currentStep === 2) {
      if (!dayAvailability.isDayOpen) {
        setErrorMessage(
          dayAvailability.dayReason || 'Ce jour est fermé. Merci de choisir une autre date.'
        );
        return;
      }
      if (dayAvailability.flexibleHours) {
        if (!/^\d{2}:\d{2}$/.test(preferredTime)) {
          setErrorMessage('Veuillez indiquer une heure souhaitée.');
          return;
        }
        if (dayAvailability.unavailableTimes.includes(preferredTime)) {
          setErrorMessage('Cette heure est déjà prise. Merci d’en choisir une autre.');
          return;
        }
      } else {
        const slotAvailable = dayAvailability.slots.some(
          (s) => s.time === preferredTime && s.available
        );
        if (!slotAvailable) {
          setErrorMessage('Ce créneau est complet. Veuillez sélectionner un horaire disponible.');
          return;
        }
      }
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPrevStep = () => {
    setErrorMessage('');
    setCurrentStep((prev) => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage('');

    if (!currentService || !pricing) {
      setErrorMessage('Veuillez sélectionner une prestation.');
      return;
    }

    if (!dayAvailability.isDayOpen) {
      setErrorMessage(
        dayAvailability.dayReason || 'Aucun créneau disponible à cette date. Merci d’en choisir une autre.'
      );
      return;
    }

    if (!clientName.trim() || !clientPhone.trim() || !clientEmail.trim()) {
      setErrorMessage(
        'Merci d’indiquer votre nom, votre téléphone et votre adresse e-mail pour recevoir la validation.'
      );
      return;
    }

    if (currentService.category === 'blanchiment' && !contraindicationsConfirmed) {
      setErrorMessage(
        'Veuillez confirmer avoir pris connaissance des contre-indications du blanchiment dentaire.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await submitBooking({
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim(),
        clientInstagram: clientInstagram.trim(),
        serviceId: currentService.id,
        variant,
        addonIds: chosenAddons.map((a) => a.id),
        preferredDate,
        preferredTime,
        contraindicationsConfirmed,
        notes: notes.trim() || undefined,
      });

      setConfirmedBooking(response.booking);
      setCopied(false);
      dialogRef.current?.showModal();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erreur lors de l’enregistrement de la demande.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopySummary = async () => {
    if (!confirmedBooking) return;
    const text = buildBookingClipboardSummary(confirmedBooking);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const standardAvailable = dayAvailability.slots.filter((s) => !s.isEvening);
  const eveningAvailable = dayAvailability.slots.filter((s) => s.isEvening);

  return (
    <section
      id="reservation"
      aria-labelledby="reservation-heading"
      className="surface-paper border-b border-stone/70 px-4 py-4 sm:px-6 sm:py-8"
    >
      <div className="mx-auto max-w-3xl">
        {/* En-tête */}
        <div className="text-center">
          <p className="text-[11px] font-medium tracking-[0.24em] text-taupe uppercase">
            Réservation en ligne
          </p>
          <h2 id="reservation-heading" className="mt-1 font-serif text-2xl text-charcoal sm:text-3xl">
            Réserver votre créneau
          </h2>
          <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-taupe">
            Réservation intuitive et rapide en 3 étapes.
          </p>
        </div>

        {/* Stepper épuré et carré — Style du site */}
        <div className="mt-4 mb-4 border border-charcoal/15 bg-white p-2 sm:p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <button
              type="button"
              onClick={() => goToStep(1)}
              className={`flex flex-col items-center justify-center py-1.5 transition-colors cursor-pointer border-b-2 ${
                currentStep === 1
                  ? 'border-charcoal text-charcoal font-semibold'
                  : currentStep > 1
                    ? 'border-charcoal/40 text-charcoal'
                    : 'border-transparent text-taupe'
              }`}
            >
              <span className="text-[10px] tracking-widest uppercase">Étape 1</span>
              <span className="font-serif text-xs sm:text-sm">Prestation</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (currentService) goToStep(2);
              }}
              className={`flex flex-col items-center justify-center py-1.5 transition-colors cursor-pointer border-b-2 ${
                currentStep === 2
                  ? 'border-charcoal text-charcoal font-semibold'
                  : currentStep > 2
                    ? 'border-charcoal/40 text-charcoal'
                    : 'border-transparent text-taupe'
              }`}
            >
              <span className="text-[10px] tracking-widest uppercase">Étape 2</span>
              <span className="font-serif text-xs sm:text-sm">Date & Heure</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (currentService && dayAvailability.isDayOpen) goToStep(3);
              }}
              className={`flex flex-col items-center justify-center py-1.5 transition-colors cursor-pointer border-b-2 ${
                currentStep === 3
                  ? 'border-charcoal text-charcoal font-semibold'
                  : 'border-transparent text-taupe'
              }`}
            >
              <span className="text-[10px] tracking-widest uppercase">Étape 3</span>
              <span className="font-serif text-xs sm:text-sm">Coordonnées</span>
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          aria-labelledby="reservation-heading"
          className="border border-charcoal/15 bg-white p-4 shadow-[0_16px_40px_-20px_rgba(20,19,17,0.10)] sm:p-7"
        >
          {errorMessage && (
            <p role="alert" className="mb-6 border border-red-800/30 bg-red-50 px-4 py-3 text-xs text-red-900">
              {errorMessage}
            </p>
          )}

          {/* ========================================================= */}
          {/* ÉTAPE 1 : PRESTATION & FORMULE                            */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="border-b border-charcoal/15 pb-3">
                <p className="text-[10px] tracking-widest uppercase text-taupe">Étape 1 sur 3</p>
                <h3 className="font-serif text-2xl text-charcoal sm:text-3xl">
                  Votre prestation &amp; formule
                </h3>
              </div>

              {/* Sélecteur de catégorie rapide */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['extensions', 'rehaussement', 'blanchiment', 'depose'] as ServiceCategory[]).map(
                  (cat) => {
                    const hasItems = activeServices.some((s) => s.category === cat);
                    if (!hasItems) return null;
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategoryChange(cat)}
                        className={`min-h-[44px] border px-3 py-2 text-xs font-medium tracking-wider uppercase transition-colors cursor-pointer ${
                          active
                            ? 'border-charcoal bg-charcoal text-ivory'
                            : 'border-stone bg-paper text-charcoal hover:border-charcoal'
                        }`}
                      >
                        {CATEGORY_LABELS[cat]}
                      </button>
                    );
                  }
                )}
              </div>

              {/* Carte résumé de la prestation active */}
              {currentService && (
                <div className="border border-charcoal/15 bg-ivory/40 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {(() => {
                      const fallback = SERVICE_DEFAULT_ILLUSTRATIONS[currentService.id] || '/srv-pose-mixte.jpg';
                      const isVid = isVideoUrl(currentService.imageUrl);
                      const imgSrc = (!currentService.imageUrl || isVid)
                        ? fallback
                        : optimizeCloudinaryUrl(currentService.imageUrl, 240);

                      return (
                        <img
                          src={imgSrc}
                          alt={currentService.name}
                          onError={(e) => {
                            if (e.currentTarget.src !== fallback) {
                              e.currentTarget.src = fallback;
                            }
                          }}
                          className="h-20 w-20 border border-charcoal/15 object-cover shrink-0 bg-ivory"
                        />
                      );
                    })()}
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="font-serif text-xl text-charcoal sm:text-2xl">
                          {currentService.name}
                        </h4>
                        <span className="font-serif text-2xl text-charcoal">
                          {currentService.fullPrice}€
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="inline-flex items-center border border-charcoal/15 bg-white px-2 py-0.5 text-[10px] font-medium tracking-wider text-charcoal uppercase">
                          Durée : {currentService.category === 'extensions' ? '2h' : `${currentService.durationMinutes} min`}
                        </span>
                      </div>
                      {currentService.description && (
                        <p className="mt-1.5 text-xs text-taupe leading-relaxed">
                          {currentService.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Choix de la prestation précise */}
              <div className="space-y-1.5">
                <label
                  htmlFor="booking-service"
                  className="block text-xs font-medium tracking-wider text-taupe uppercase"
                >
                  Changer de prestation
                </label>
                <select
                  id="booking-service"
                  name="serviceId"
                  value={currentService?.id || ''}
                  onChange={(e) => {
                    setSelectedServiceId(e.target.value);
                    setContraindicationsConfirmed(false);
                  }}
                  className="min-h-[48px] w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-base sm:text-sm text-charcoal"
                >
                  {categoryServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.fullPrice} €
                      {s.refillPrice != null
                        ? ` (${s.refillLabel || 'Remplissage'} : ${s.refillPrice} €)`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Formules si disponible */}
              {currentService && currentService.refillPrice != null && (
                <div className="space-y-2 pt-2">
                  <span className="block text-xs font-medium tracking-wider text-taupe uppercase">
                    Choisir votre formule
                  </span>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <label className="flex min-h-[50px] cursor-pointer items-center justify-between border border-stone px-4 py-3 has-[:checked]:border-charcoal has-[:checked]:bg-ivory">
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="variant"
                          value="full"
                          checked={variant === 'full'}
                          onChange={() => setVariant('full')}
                          className="h-4 w-4 accent-charcoal"
                        />
                        <span className="text-sm font-medium text-charcoal">
                          {currentService.fullLabel || 'Pose complète'}
                        </span>
                      </span>
                      <span className="font-serif text-xl text-charcoal">
                        {currentService.fullPrice} €
                      </span>
                    </label>

                    <label className="flex min-h-[50px] cursor-pointer items-center justify-between border border-stone px-4 py-3 has-[:checked]:border-charcoal has-[:checked]:bg-ivory">
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="variant"
                          value={currentService.category === 'rehaussement' ? 'tint' : 'refill'}
                          checked={variant === 'refill' || variant === 'tint'}
                          onChange={() =>
                            setVariant(currentService.category === 'rehaussement' ? 'tint' : 'refill')
                          }
                          className="h-4 w-4 accent-charcoal"
                        />
                        <span className="text-sm font-medium text-charcoal">
                          {currentService.refillLabel || 'Remplissage 3 semaines'}
                        </span>
                      </span>
                      <span className="font-serif text-xl text-charcoal">
                        {currentService.refillPrice} €
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Options & Finitions */}
              {availableAddons.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="block text-xs font-medium tracking-wider text-taupe uppercase">
                    Options supplémentaires (facultatif)
                  </span>
                  <div className="space-y-2">
                    {availableAddons.map((addon) => (
                      <label
                        key={addon.id}
                        className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 border border-stone/80 px-3.5 py-2.5 transition-colors hover:border-charcoal"
                      >
                        <span className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedAddonIds.includes(addon.id)}
                            onChange={() => toggleAddon(addon.id)}
                            className="mt-1 h-4 w-4 accent-charcoal"
                          />
                          <span>
                            <span className="block text-sm font-medium text-charcoal">
                              {addon.name}
                            </span>
                            <span className="block text-xs text-taupe">{addon.description}</span>
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-charcoal uppercase">
                          {addon.price > 0 ? `+${addon.price} €` : addon.priceLabel || 'Gratuit'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Bouton Suivant Étape 1 */}
              <div className="pt-4 border-t border-charcoal/15 flex justify-end">
                <button
                  type="button"
                  onClick={goToNextStep}
                  className="inline-flex min-h-[48px] items-center gap-2 border border-charcoal bg-charcoal px-6 py-2.5 text-xs font-medium tracking-widest uppercase text-ivory hover:bg-silk transition-colors cursor-pointer"
                >
                  <span>Choisir la date &amp; l'heure</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* ÉTAPE 2 : DATE & HEURE                                    */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="border-b border-charcoal/15 pb-3">
                <p className="text-[10px] tracking-widest uppercase text-taupe">Étape 2 sur 3</p>
                <h3 className="font-serif text-2xl text-charcoal sm:text-3xl">
                  Date &amp; heure souhaitée
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
                <div className="space-y-1.5">
                  <label
                    htmlFor="booking-date"
                    className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-taupe uppercase"
                  >
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Date souhaitée</span>
                  </label>
                  <input
                    id="booking-date"
                    name="preferredDate"
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={preferredDate}
                    onChange={(e) => {
                      setPreferredDate(e.target.value);
                      setErrorMessage('');
                    }}
                    required
                    className="min-h-[48px] w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-base sm:text-sm text-charcoal"
                  />
                  <span className="block text-[11px] text-taupe capitalize">
                    {formatFrenchDate(preferredDate)}
                  </span>
                </div>

                {dayAvailability.isDayOpen && dayAvailability.flexibleHours && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="booking-time-flexible"
                      className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-taupe uppercase"
                    >
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Heure souhaitée</span>
                    </label>
                    <input
                      id="booking-time-flexible"
                      name="preferredTime"
                      type="time"
                      value={preferredTime}
                      onChange={(e) => {
                        setPreferredTime(e.target.value);
                        setErrorMessage('');
                      }}
                      required
                      className="min-h-[48px] w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-base sm:text-sm text-charcoal"
                    />
                    {dayAvailability.unavailableTimes.includes(preferredTime) ? (
                      <span className="block text-[11px] font-medium text-red-800">
                        Cette heure est déjà prise ce jour-là, choisissez un autre horaire.
                      </span>
                    ) : (
                      <span className="block text-[11px] text-taupe">
                        {pricing?.isSupplementApplied
                          ? `+${pricing.supplementPrice} € (${pricing.supplementReason})`
                          : 'Tarif normal sur cet horaire'}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {!dayAvailability.isDayOpen ? (
                <p role="status" className="border border-red-800/30 bg-red-50 px-4 py-3 text-xs text-red-900">
                  {dayAvailability.dayReason}
                </p>
              ) : !dayAvailability.flexibleHours ? (
                <div className="space-y-5">
                  {standardAvailable.length > 0 && (
                    <div className="space-y-2.5">
                      <span className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-taupe uppercase">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Créneaux disponibles</span>
                      </span>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {standardAvailable.map((slot) => {
                          const selected = preferredTime === slot.time;
                          return (
                            <label
                              key={slot.time}
                              className={`flex min-h-[48px] flex-col items-center justify-center border px-2 py-2 text-center transition-colors ${
                                !slot.available
                                  ? 'cursor-not-allowed border-stone/60 bg-ivory/70 text-taupe/60 line-through'
                                  : selected
                                    ? 'cursor-pointer border-charcoal bg-charcoal text-ivory'
                                    : 'cursor-pointer border-stone bg-white text-charcoal hover:border-charcoal'
                              }`}
                            >
                              <input
                                type="radio"
                                name="preferredTime"
                                value={slot.time}
                                disabled={!slot.available}
                                checked={selected}
                                onChange={() => {
                                  setPreferredTime(slot.time);
                                  setErrorMessage('');
                                }}
                                className="visually-hidden"
                              />
                              <span className="text-sm font-medium">{slot.time}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {eveningAvailable.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium tracking-wider text-taupe uppercase">
                          Créneaux en soirée (+{bookingRules.supplementAmount}€)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {eveningAvailable.map((slot) => {
                          const selected = preferredTime === slot.time;
                          return (
                            <label
                              key={slot.time}
                              className={`flex min-h-[48px] flex-col items-center justify-center border px-2 py-2 text-center transition-colors ${
                                !slot.available
                                  ? 'cursor-not-allowed border-stone/60 bg-ivory/70 text-taupe/60 line-through'
                                  : selected
                                    ? 'cursor-pointer border-charcoal bg-charcoal text-ivory'
                                    : 'cursor-pointer border-amber-800/30 bg-amber-50/40 text-charcoal hover:border-charcoal'
                              }`}
                            >
                              <input
                                type="radio"
                                name="preferredTime"
                                value={slot.time}
                                disabled={!slot.available}
                                checked={selected}
                                onChange={() => {
                                  setPreferredTime(slot.time);
                                  setErrorMessage('');
                                }}
                                className="visually-hidden"
                              />
                              <span className="text-sm font-medium">{slot.time}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Boutons Retour / Suivant Étape 2 */}
              <div className="pt-4 border-t border-charcoal/15 flex items-center justify-between">
                <button
                  type="button"
                  onClick={goToPrevStep}
                  className="inline-flex min-h-[48px] items-center gap-1.5 border border-stone bg-white px-4 py-2.5 text-xs font-medium tracking-wider uppercase text-charcoal hover:border-charcoal transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Retour</span>
                </button>

                <button
                  type="button"
                  onClick={goToNextStep}
                  className="inline-flex min-h-[48px] items-center gap-2 border border-charcoal bg-charcoal px-6 py-2.5 text-xs font-medium tracking-widest uppercase text-ivory hover:bg-silk transition-colors cursor-pointer"
                >
                  <span>Mes coordonnées</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* ÉTAPE 3 : COORDONNÉES & VALIDATION                         */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="border-b border-charcoal/15 pb-3">
                <p className="text-[10px] tracking-widest uppercase text-taupe">Étape 3 sur 3</p>
                <h3 className="font-serif text-2xl text-charcoal sm:text-3xl">
                  Vos coordonnées &amp; confirmation
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="client-name"
                    className="block text-xs font-medium tracking-wider text-taupe uppercase"
                  >
                    Prénom et Nom <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="client-name"
                    name="clientName"
                    type="text"
                    autoComplete="name"
                    required
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="Camille Laurent"
                    className="min-h-[48px] w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-base sm:text-sm text-charcoal"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="client-phone"
                    className="block text-xs font-medium tracking-wider text-taupe uppercase"
                  >
                    Téléphone <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="client-phone"
                    name="clientPhone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    value={clientPhone}
                    onChange={(e) => {
                      setClientPhone(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="06 12 34 56 78"
                    className="min-h-[48px] w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-base sm:text-sm text-charcoal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="client-email"
                    className="block text-xs font-medium tracking-wider text-taupe uppercase"
                  >
                    E-mail (pour confirmation) <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="client-email"
                    name="clientEmail"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={clientEmail}
                    onChange={(e) => {
                      setClientEmail(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="camille@gmail.com"
                    className="min-h-[48px] w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-base sm:text-sm text-charcoal"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="client-instagram"
                    className="block text-xs font-medium tracking-wider text-taupe uppercase"
                  >
                    Pseudo Instagram (facultatif)
                  </label>
                  <input
                    id="client-instagram"
                    name="clientInstagram"
                    type="text"
                    value={clientInstagram}
                    onChange={(e) => setClientInstagram(e.target.value)}
                    placeholder="@votrecompte"
                    className="min-h-[48px] w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-base sm:text-sm text-charcoal"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="client-notes"
                  className="block text-xs font-medium tracking-wider text-taupe uppercase"
                >
                  Précisions éventuelles (facultatif)
                </label>
                <textarea
                  id="client-notes"
                  name="notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex. souplesse horaire, pose extérieure déjà présente..."
                  className="w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-base sm:text-sm text-charcoal"
                />
              </div>

              {currentService?.category === 'blanchiment' && (
                <label className="flex min-h-[52px] cursor-pointer items-start gap-3 border border-charcoal/30 bg-ivory p-4">
                  <input
                    type="checkbox"
                    checked={contraindicationsConfirmed}
                    onChange={(e) => {
                      setContraindicationsConfirmed(e.target.checked);
                      setErrorMessage('');
                    }}
                    className="mt-1 h-4 w-4 shrink-0 accent-charcoal"
                  />
                  <span className="text-xs leading-relaxed text-charcoal">
                    Je confirme ne présenter aucune contre-indication au blanchiment dentaire.
                  </span>
                </label>
              )}

              {/* Récapitulatif Final */}
              {pricing && currentService && (
                <div className="border border-charcoal/20 bg-ivory/80 p-4 sm:p-5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-[10px] tracking-widest uppercase text-taupe">Récapitulatif</p>
                      <p className="font-serif text-lg text-charcoal sm:text-xl">
                        {currentService.name} — {pricing.variantLabel}
                      </p>
                      <p className="text-xs text-taupe">
                        {formatFrenchDate(preferredDate)} à {preferredTime}
                        {pricing.isSupplementApplied
                          ? ` · Supplément +${pricing.supplementPrice} € (${pricing.supplementReason})`
                          : ''}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="block text-[10px] tracking-wider uppercase text-taupe">Total estimé</span>
                      <span className="font-serif text-3xl font-normal text-charcoal">{pricing.totalPrice} €</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Boutons Retour / Confirmer Étape 3 */}
              <div className="pt-4 border-t border-charcoal/15 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={goToPrevStep}
                  className="inline-flex min-h-[48px] items-center gap-1.5 border border-stone bg-white px-4 py-2.5 text-xs font-medium tracking-wider uppercase text-charcoal hover:border-charcoal transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Retour</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex min-h-[48px] flex-1 items-center justify-center gap-2 border border-charcoal bg-charcoal px-6 py-3 text-xs font-semibold tracking-[0.2em] text-ivory uppercase transition-colors hover:bg-silk disabled:opacity-60 cursor-pointer sm:flex-none"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>{isSubmitting ? 'Envoi en cours...' : 'Confirmer la réservation'}</span>
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Modal Confirmation */}
        <dialog
          ref={dialogRef}
          aria-labelledby="confirmed-modal-title"
          className="m-auto w-[92vw] max-w-xl border border-charcoal/30 bg-paper p-0 text-charcoal shadow-2xl backdrop:bg-charcoal/60 backdrop:backdrop-blur-xs"
        >
          {confirmedBooking && (
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 text-stone-900">
                <div className="flex h-10 w-10 items-center justify-center border border-charcoal bg-charcoal text-ivory">
                  <Check className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="confirmed-modal-title" className="font-serif text-2xl">
                    Demande transmise avec succès
                  </h3>
                  <p className="text-xs text-taupe">Référence : {confirmedBooking.id}</p>
                </div>
              </div>

              <div className="mt-6 space-y-3 border-y border-stone/60 py-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-taupe">Prestation :</span>
                  <span className="font-medium text-right">
                    {confirmedBooking.serviceName} ({confirmedBooking.variantLabel})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-taupe">Durée prévue :</span>
                  <span className="font-medium">
                    {currentService?.category === 'extensions' ? '2h (120 min)' : `${currentService?.durationMinutes || 60} min`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-taupe">Date &amp; heure :</span>
                  <span className="font-medium">
                    {formatFrenchDate(confirmedBooking.preferredDate)} à {confirmedBooking.preferredTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-taupe">Nom de cliente :</span>
                  <span className="font-medium">{confirmedBooking.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-taupe">Total estimé :</span>
                  <span className="font-serif text-base font-bold">
                    {confirmedBooking.totalPrice} €
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="flex min-h-[44px] flex-1 items-center justify-center gap-2 border border-charcoal px-4 py-2 text-xs font-medium uppercase tracking-wider hover:bg-ivory"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  <span>{copied ? 'Copié dans le presse-papier !' : 'Copier le récapitulatif'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => dialogRef.current?.close()}
                  className="flex min-h-[44px] items-center justify-center border border-charcoal bg-charcoal px-5 py-2 text-xs font-medium uppercase tracking-wider text-ivory hover:bg-silk"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </dialog>
      </div>
    </section>
  );
};
