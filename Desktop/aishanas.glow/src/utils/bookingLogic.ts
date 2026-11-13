import type {
  BookingRequest,
  BookingRules,
  BookingVariant,
  OccupiedSlot,
  ServiceAddon,
  ServiceItem,
} from '../types/studio';

export interface SupplementCheckResult {
  applied: boolean;
  amount: number;
  reason?: string;
}

export interface SlotAvailability {
  time: string;
  isEvening: boolean;
  available: boolean;
  reason?: string;
}

export function getDayAvailability(
  dateStr: string,
  rules: BookingRules,
  occupiedSlots: OccupiedSlot[]
): {
  isDayOpen: boolean;
  flexibleHours: boolean;
  dayReason?: string;
  unavailableTimes: string[];
  slots: SlotAvailability[];
} {
  const flexibleHours = rules.flexibleHours !== false;

  if (!dateStr) {
    return {
      isDayOpen: false,
      flexibleHours,
      dayReason: 'Veuillez sélectionner une date.',
      unavailableTimes: [],
      slots: [],
    };
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) {
    return {
      isDayOpen: false,
      flexibleHours,
      dayReason: 'Date invalide.',
      unavailableTimes: [],
      slots: [],
    };
  }

  const dateObj = new Date(year, month - 1, day);
  const weekday = dateObj.getDay();

  if (!rules.sundayEnabled && weekday === 0) {
    return {
      isDayOpen: false,
      flexibleHours,
      dayReason: 'Studio fermé le dimanche.',
      unavailableTimes: [],
      slots: [],
    };
  }

  if (rules.closedWeekdays.includes(weekday)) {
    return {
      isDayOpen: false,
      flexibleHours,
      dayReason: 'Jour de fermeture hebdomadaire.',
      unavailableTimes: [],
      slots: [],
    };
  }

  if (rules.blockedDates.includes(dateStr)) {
    return {
      isDayOpen: false,
      flexibleHours,
      dayReason: 'Journée fermée par le studio.',
      unavailableTimes: [],
      slots: [],
    };
  }

  const confirmedTimes = new Set(
    occupiedSlots
      .filter((s) => s.date === dateStr && s.status === 'confirmed')
      .map((s) => s.time)
  );
  const blockedTimes = new Set(
    rules.blockedSlots.filter((b) => b.date === dateStr).map((b) => b.time)
  );
  const unavailableTimes = Array.from(new Set([...confirmedTimes, ...blockedTimes])).sort((a, b) =>
    a.localeCompare(b)
  );

  if (flexibleHours) {
    return {
      isDayOpen: true,
      flexibleHours: true,
      unavailableTimes,
      slots: [],
    };
  }

  const allSlots: SlotAvailability[] = [
    ...rules.standardSlots.map((time) => ({
      time,
      isEvening: false,
      available: !confirmedTimes.has(time) && !blockedTimes.has(time),
      reason: confirmedTimes.has(time)
        ? 'Créneau déjà réservé'
        : blockedTimes.has(time)
          ? 'Indisponible'
          : undefined,
    })),
    ...rules.eveningSlots.map((time) => ({
      time,
      isEvening: true,
      available: !confirmedTimes.has(time) && !blockedTimes.has(time),
      reason: confirmedTimes.has(time)
        ? 'Créneau déjà réservé'
        : blockedTimes.has(time)
          ? 'Indisponible'
          : undefined,
    })),
  ];

  const hasAvailable = allSlots.some((s) => s.available);
  return {
    isDayOpen: hasAvailable,
    flexibleHours: false,
    dayReason: hasAvailable ? undefined : 'Tous les créneaux sont complets ou bloqués ce jour.',
    unavailableTimes,
    slots: allSlots,
  };
}

/**
 * Evaluates whether a date/time triggers the +10 EUR supplement
 * (after 19h, Sunday, or configured public holiday).
 */
export function evaluateSupplement(
  dateStr: string,
  timeStr: string,
  rules: BookingRules
): SupplementCheckResult {
  if ((rules.supplementAmount ?? 0) <= 0) {
    return { applied: false, amount: 0 };
  }
  const reasons: string[] = [];

  if (dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (year && month && day) {
      const dateObj = new Date(year, month - 1, day);
      if (dateObj.getDay() === 0) {
        reasons.push('Dimanche');
      }
      if (rules.holidays.includes(dateStr)) {
        reasons.push('Jour férié');
      }
    }
  }

  if (timeStr) {
    const [hoursStr] = timeStr.split(':');
    const hour = Number(hoursStr);
    if (!Number.isNaN(hour) && hour >= rules.lateHourThreshold) {
      reasons.push(`Créneau à partir de ${rules.lateHourThreshold}h`);
    }
  }

  if (reasons.length === 0) {
    return { applied: false, amount: 0 };
  }

  return {
    applied: true,
    amount: rules.supplementAmount,
    reason: reasons.join(' & '),
  };
}

export function getServiceBasePrice(
  service: ServiceItem,
  variant: BookingVariant
): { price: number; label: string } {
  if (variant === 'refill' && service.refillPrice != null) {
    return {
      price: service.refillPrice,
      label: service.refillLabel || 'Remplissage 3 semaines',
    };
  }
  if (variant === 'tint' && service.refillPrice != null) {
    return {
      price: service.refillPrice,
      label: service.refillLabel || 'Avec teinture',
    };
  }
  return {
    price: service.fullPrice,
    label: service.fullLabel || 'Pose complète',
  };
}

export function calculateBookingTotal(
  service: ServiceItem,
  variant: BookingVariant,
  selectedAddons: ServiceAddon[],
  dateStr: string,
  timeStr: string,
  rules: BookingRules
) {
  const { price: basePrice, label: variantLabel } = getServiceBasePrice(service, variant);
  const addonsPrice = selectedAddons.reduce((sum, item) => sum + item.price, 0);
  const supplement = evaluateSupplement(dateStr, timeStr, rules);
  return {
    basePrice,
    variantLabel,
    addonsPrice,
    supplementPrice: supplement.amount,
    isSupplementApplied: supplement.applied,
    supplementReason: supplement.reason,
    totalPrice: basePrice + addonsPrice + supplement.amount,
  };
}

export function generateBookingReference(): string {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `AG-${random}`;
}

export function formatFrenchDate(dateStr: string): string {
  if (!dateStr) return 'À convenir';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function buildBookingClipboardSummary(booking: BookingRequest): string {
  const lines = [
    `Demande de rendez-vous — Alshana's Glow (${booking.reference})`,
    `Prestation : ${booking.serviceName} (${booking.variantLabel})`,
    booking.addonNames.length > 0 ? `Options : ${booking.addonNames.join(', ')}` : null,
    `Date souhaitée : ${formatFrenchDate(booking.preferredDate)}`,
    `Heure souhaitée : ${booking.preferredTime}`,
    booking.isSupplementApplied
      ? `Supplément horaire/jour (+${booking.supplementPrice} €) : ${booking.supplementReason}`
      : null,
    `Total estimé : ${booking.totalPrice} €`,
    `Cliente : ${booking.clientName} | Tél : ${booking.clientPhone}`,
    booking.clientEmail ? `E-mail : ${booking.clientEmail}` : null,
    booking.clientInstagram ? `Instagram : ${booking.clientInstagram}` : null,
    booking.notes ? `Précisions : ${booking.notes}` : null,
  ].filter(Boolean);

  return lines.join('\n');
}
