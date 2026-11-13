import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Check, Clock, Copy, Instagram, Mail, ShieldCheck } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import type { BookingRequest, BookingVariant, ServiceCategory } from '../types/studio';
import {
  buildBookingClipboardSummary,
  calculateBookingTotal,
  formatFrenchDate,
  getDayAvailability,
} from '../utils/bookingLogic';
import {
  buildBookingMailtoUrl,
  type ServerEmailNotification,
} from '../utils/emailDispatch';

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
  const [emailStatus, setEmailStatus] = useState<ServerEmailNotification | null>(null);
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
    }
  }, [preselectedServiceId, preselectedVariant, selectionTick]);

  const dayAvailability = useMemo(
    () => getDayAvailability(preferredDate, bookingRules, data.occupiedSlots),
    [preferredDate, bookingRules, data.occupiedSlots]
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

  const categoryServices = activeServices.filter((s) => s.category === selectedCategory);
  const currentService =
    activeServices.find((s) => s.id === selectedServiceId) ||
    categoryServices[0] ||
    activeServices[0];

  const availableAddons = activeAddons.filter(
    (addon) => currentService && addon.applicableCategories.includes(currentService.category)
  );
  const chosenAddons = availableAddons.filter((a) => selectedAddonIds.includes(a.id));

  const pricing = currentService
    ? calculateBookingTotal(
        currentService,
        variant,
        chosenAddons,
        preferredDate,
        preferredTime,
        bookingRules
      )
    : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if ('closedBy' in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
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

    if (dayAvailability.flexibleHours) {
      if (!/^\d{2}:\d{2}$/.test(preferredTime)) {
        setErrorMessage('Veuillez indiquer votre heure souhaitée.');
        return;
      }
      if (dayAvailability.unavailableTimes.includes(preferredTime)) {
        setErrorMessage('Cette heure est déjà prise ou bloquée ce jour-là. Merci d’en choisir une autre.');
        return;
      }
    } else {
      const chosenSlotAvailable = dayAvailability.slots.some(
        (s) => s.time === preferredTime && s.available
      );
      if (!chosenSlotAvailable) {
        setErrorMessage('Ce créneau n’est plus disponible. Merci de choisir un autre horaire.');
        return;
      }
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
      setEmailStatus(response.emailNotification);
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
      className="surface-paper border-b border-stone/70 px-4 py-14 sm:px-6 sm:py-20"
    >
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-[11px] font-medium tracking-[0.24em] text-taupe uppercase">
            Prise de rendez-vous en ligne
          </p>
          <h2 id="reservation-heading" className="mt-2 font-serif text-3xl text-charcoal sm:text-5xl">
            Réserver votre créneau
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-taupe sm:text-sm">
            Choisissez un créneau disponible. Votre demande est transmise au studio, puis vous
            recevez votre confirmation définitive par e-mail dès validation.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          aria-labelledby="reservation-heading"
          className="mt-10 space-y-8 border border-charcoal/15 bg-white p-5 shadow-[0_24px_60px_-30px_rgba(20,19,17,0.14)] sm:p-10"
        >
          {/* ÉTAPE 1 : CATÉGORIE & PRESTATION */}
          <fieldset className="space-y-4 border-b border-stone/60 pb-7">
            <legend className="font-serif text-2xl text-charcoal">
              1. Prestation souhaitée
            </legend>

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
                      className={`min-h-[48px] border px-3 py-2 text-xs font-medium tracking-wider uppercase transition-colors ${
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

            <div className="space-y-1.5">
              <label
                htmlFor="booking-service"
                className="block text-xs font-medium tracking-wider text-taupe uppercase"
              >
                Prestation précise
              </label>
              <select
                id="booking-service"
                name="serviceId"
                value={currentService?.id || ''}
                onChange={(e) => {
                  setSelectedServiceId(e.target.value);
                  setContraindicationsConfirmed(false);
                }}
                className="min-h-[48px] w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-charcoal"
              >
                {categoryServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.fullPrice} €
                    {s.refillPrice != null
                      ? ` (${s.refillLabel || 'Option'} : ${s.refillPrice} €)`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            {currentService && currentService.refillPrice != null && (
              <div className="space-y-2">
                <span className="block text-xs font-medium tracking-wider text-taupe uppercase">
                  Formule
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

                {currentService.category === 'extensions' && variant === 'refill' && (
                  <p className="border-l-2 border-charcoal bg-ivory px-3 py-2 text-xs text-charcoal">
                    Rappel : {bookingRules.refillPolicyNote}
                  </p>
                )}
              </div>
            )}

            {availableAddons.length > 0 && (
              <div className="space-y-2 pt-1">
                <span className="block text-xs font-medium tracking-wider text-taupe uppercase">
                  Options & Finitions (facultatif)
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
          </fieldset>

          {/* ÉTAPE 2 : DATE & HEURE SOUHAITÉE */}
          <fieldset className="space-y-5 border-b border-stone/60 pb-7">
            <legend className="font-serif text-2xl text-charcoal">
              2. Date et heure souhaitée
            </legend>

            <p className="text-xs leading-relaxed text-taupe">
              {dayAvailability.flexibleHours
                ? 'Créneaux flexibles : choisissez votre date et l’heure qui vous arrange.'
                : 'Choisissez votre date et l’un des créneaux proposés.'}{' '}
              {bookingRules.supplementAmount > 0 && (
                <>
                  Supplément de <strong className="text-charcoal">{bookingRules.supplementAmount} €</strong>{' '}
                  {bookingRules.lateHourThreshold < 24
                    ? `à partir de ${bookingRules.lateHourThreshold}h00, `
                    : ''}
                  le dimanche et les jours fériés.
                </>
              )}
            </p>

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
                  className="min-h-[48px] w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-charcoal"
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
                    className="min-h-[48px] w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-charcoal"
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

            {dayAvailability.isDayOpen &&
              dayAvailability.flexibleHours &&
              dayAvailability.unavailableTimes.length > 0 && (
                <p className="border-l-2 border-stone bg-ivory px-3.5 py-2 text-xs text-charcoal">
                  Déjà pris ou bloqué ce jour :{' '}
                  <strong>{dayAvailability.unavailableTimes.join(', ')}</strong>
                </p>
              )}

            {!dayAvailability.isDayOpen ? (
              <p
                role="status"
                className="border border-red-800/30 bg-red-50 px-4 py-3 text-xs text-red-900"
              >
                {dayAvailability.dayReason}
              </p>
            ) : !dayAvailability.flexibleHours ? (
              <div className="space-y-5">
                {(() => {
                  const [yr, mo, dy] = preferredDate.split('-').map(Number);
                  const isSundayOrHoliday =
                    Boolean(yr && mo && dy && new Date(yr, mo - 1, dy).getDay() === 0) ||
                    bookingRules.holidays.includes(preferredDate);

                  return (
                    <>
                      {standardAvailable.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-taupe uppercase">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Créneaux en journée</span>
                            </span>
                            <span className="text-[11px] font-medium text-charcoal">
                              {isSundayOrHoliday
                                ? `Dimanche / Férié (+${bookingRules.supplementAmount} €)`
                                : 'Tarif normal'}
                            </span>
                          </div>
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
                                  {!slot.available && (
                                    <span className="text-[10px]">Indisponible</span>
                                  )}
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
                              Créneaux en soirée (dès {bookingRules.lateHourThreshold}h00)
                            </span>
                            <span className="border border-amber-800/30 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-950">
                              +{bookingRules.supplementAmount} €
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
                                  <span
                                    className={`text-[10px] ${
                                      !slot.available
                                        ? ''
                                        : selected
                                          ? 'text-stone'
                                          : 'text-amber-900'
                                    }`}
                                  >
                                    {!slot.available
                                      ? 'Indisponible'
                                      : `+${bookingRules.supplementAmount} €`}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : null}

            {dayAvailability.isDayOpen && pricing?.isSupplementApplied && (
              <p
                role="status"
                className="border border-amber-800/30 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-charcoal"
              >
                Supplément appliqué (+{pricing.supplementPrice} €) :{' '}
                <strong>{pricing.supplementReason}</strong>.
              </p>
            )}
          </fieldset>

          {/* ÉTAPE 3 : COORDONNÉES & CONTRE-INDICATIONS */}
          <fieldset className="space-y-4">
            <legend className="font-serif text-2xl text-charcoal">3. Vos coordonnées</legend>

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
                  className="min-h-[48px] w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-charcoal"
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
                  className="min-h-[48px] w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-charcoal"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="client-email"
                  className="block text-xs font-medium tracking-wider text-taupe uppercase"
                >
                  E-mail (pour la confirmation) <span aria-hidden="true">*</span>
                </label>
                <input
                  id="client-email"
                  name="clientEmail"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={clientEmail}
                  onChange={(e) => {
                    setClientEmail(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="camille@gmail.com"
                  className="min-h-[48px] w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-charcoal"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="client-instagram"
                  className="block text-xs font-medium tracking-wider text-taupe uppercase"
                >
                  Pseudo Instagram (suivi rapide)
                </label>
                <input
                  id="client-instagram"
                  name="clientInstagram"
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={clientInstagram}
                  onChange={(e) => setClientInstagram(e.target.value)}
                  placeholder="@votrecompte"
                  className="min-h-[48px] w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-charcoal"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="client-notes"
                className="block text-xs font-medium tracking-wider text-taupe uppercase"
              >
                Précisions ou demande de réajustement (facultatif)
              </label>
              <textarea
                id="client-notes"
                name="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex. souplesse horaire, pose déjà présente d’un autre institut, précision sur le rendu souhaité..."
                className="w-full border border-charcoal/30 bg-white px-3.5 py-2.5 text-charcoal"
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
                  Je confirme ne présenter aucune contre-indication au blanchiment dentaire (pas de
                  grossesse/allaitement, pas de composite, facette ou couronne sur dents visibles,
                  pas de carie sur les incisives).
                </span>
              </label>
            )}
          </fieldset>

          {/* RÉCAPITULATIF & VALIDATION */}
          {pricing && currentService && (
            <div className="border-t border-charcoal/20 bg-ivory/80 p-4 sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <p className="text-xs font-medium tracking-wider text-taupe uppercase">
                    Récapitulatif estimé
                  </p>
                  <p className="font-serif text-xl text-charcoal">
                    {currentService.name} — {pricing.variantLabel}
                  </p>
                  <p className="text-xs text-taupe">
                    {formatFrenchDate(preferredDate)} à {preferredTime || '—'}
                    {pricing.isSupplementApplied
                      ? ` · Supplément +${pricing.supplementPrice} € (${pricing.supplementReason})`
                      : ''}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <span className="block text-[11px] tracking-wider text-taupe uppercase">
                    Total estimé
                  </span>
                  <span className="font-serif text-4xl text-charcoal">{pricing.totalPrice} €</span>
                </div>
              </div>

              {errorMessage && (
                <p role="alert" className="mt-4 border border-red-800/30 bg-red-50 px-3 py-2 text-xs text-red-900">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 border border-charcoal bg-charcoal px-6 py-3.5 text-xs font-semibold tracking-[0.2em] text-ivory uppercase transition-colors hover:bg-silk disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>
                  {isSubmitting
                    ? 'Transmission de votre demande...'
                    : 'Envoyer ma demande de rendez-vous'}
                </span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Native <dialog> confirmation */}
      <dialog ref={dialogRef} aria-labelledby="booking-confirm-title" closedby="any">
        {confirmedBooking && (
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between border-b border-stone pb-4">
              <span className="text-[11px] font-medium tracking-[0.2em] text-taupe uppercase">
                En attente de validation · {confirmedBooking.reference}
              </span>
              <form method="dialog">
                <button
                  type="submit"
                  value="close"
                  className="min-h-[44px] px-2 text-xs tracking-wider text-taupe uppercase hover:text-charcoal"
                >
                  Fermer
                </button>
              </form>
            </div>

            <h3 id="booking-confirm-title" className="mt-5 font-serif text-3xl text-charcoal">
              Demande transmise au studio
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-taupe sm:text-sm">
              Votre créneau est soumis à la validation de l’administrateur. Dès qu’il est validé,
              vous recevez un e-mail de confirmation sur{' '}
              <strong className="text-charcoal">{confirmedBooking.clientEmail}</strong>.
            </p>

            <dl className="mt-5 space-y-2 border border-stone bg-ivory p-4 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-taupe">Prestation</dt>
                <dd className="text-right font-medium text-charcoal">
                  {confirmedBooking.serviceName} ({confirmedBooking.variantLabel})
                </dd>
              </div>
              {confirmedBooking.addonNames.length > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-taupe">Options</dt>
                  <dd className="text-right text-charcoal">
                    {confirmedBooking.addonNames.join(', ')}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-taupe">Créneau demandé</dt>
                <dd className="text-right text-charcoal">
                  {formatFrenchDate(confirmedBooking.preferredDate)} à{' '}
                  {confirmedBooking.preferredTime}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-stone/70 pt-2">
                <dt className="font-medium text-charcoal">Total estimé</dt>
                <dd className="font-serif text-xl text-charcoal">
                  {confirmedBooking.totalPrice} €
                </dd>
              </div>
            </dl>

            {emailStatus && (
              <p
                role="status"
                className={`mt-4 border px-3.5 py-2.5 text-xs leading-relaxed ${
                  emailStatus.delivered
                    ? 'border-emerald-800/30 bg-emerald-50 text-emerald-950'
                    : 'border-amber-800/30 bg-amber-50 text-amber-950'
                }`}
              >
                {emailStatus.message}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-2.5">
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="flex min-h-[48px] flex-1 items-center justify-center gap-2 border border-charcoal px-4 py-2.5 text-xs font-medium tracking-wider text-charcoal uppercase transition-colors hover:bg-ivory"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <span>Récapitulatif copié</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" aria-hidden="true" />
                      <span>Copier le récapitulatif</span>
                    </>
                  )}
                </button>

                <a
                  href={data.config.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[48px] flex-1 items-center justify-center gap-2 border border-charcoal bg-charcoal px-4 py-2.5 text-xs font-medium tracking-wider text-ivory uppercase transition-colors hover:bg-silk"
                >
                  <Instagram className="h-4 w-4" aria-hidden="true" />
                  <span>Ouvrir {data.config.handle}</span>
                </a>
              </div>

              {data.config.contactEmail && (
                <a
                  href={buildBookingMailtoUrl(confirmedBooking, data.config.contactEmail)}
                  className="flex min-h-[46px] w-full items-center justify-center gap-2 border border-stone bg-white px-4 py-2 text-xs font-medium tracking-wider text-charcoal uppercase transition-colors hover:border-charcoal"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <span>Doubler par e-mail ({data.config.contactEmail})</span>
                </a>
              )}
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
};
