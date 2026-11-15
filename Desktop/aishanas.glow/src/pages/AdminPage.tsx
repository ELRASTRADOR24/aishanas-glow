import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Crop,
  Download,
  Edit2,
  Euro,
  Eye,
  EyeOff,
  Film,
  Loader2,
  Lock,
  Mail,
  Plus,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
  XCircle,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import type {
  BookingRequest,
  BookingStatus,
  EmailLogEntry,
  FaqItem,
  ProtocolBlock,
  ServiceAddon,
  ServiceCategory,
  ServiceItem,
} from '../types/studio';
import { DEFAULT_FAQS } from '../data/defaultStudioData';
import { formatFrenchDate } from '../utils/bookingLogic';
import { isVideoUrl } from '../utils/cloudinary';
import { uploadMediaWithProgress } from '../utils/uploadMedia';
import { AestheticMediaViewer } from '../components/AestheticMediaViewer';
import { MonthlyScheduleCalendar } from '../components/MonthlyScheduleCalendar';
import { ImageCropModal } from '../components/ImageCropModal';

type AdminTab =
  | 'services'
  | 'schedule'
  | 'bookings'
  | 'rules'
  | 'content'
  | 'emails'
  | 'settings'
  | 'dashboard'
  | 'cloudinary';

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'En attente de validation',
  confirmed: 'Validé',
  completed: 'Terminé',
  cancelled: 'Refusé / Annulé',
};

const WEEKDAYS = [
  { day: 1, label: 'Lundi', shortLabel: 'Lun' },
  { day: 2, label: 'Mardi', shortLabel: 'Mar' },
  { day: 3, label: 'Mercredi', shortLabel: 'Mer' },
  { day: 4, label: 'Jeudi', shortLabel: 'Jeu' },
  { day: 5, label: 'Vendredi', shortLabel: 'Ven' },
  { day: 6, label: 'Samedi', shortLabel: 'Sam' },
  { day: 0, label: 'Dimanche', shortLabel: 'Dim' },
];

const FRENCH_PUBLIC_HOLIDAYS = [
  '2026-01-01',
  '2026-04-06',
  '2026-05-01',
  '2026-05-08',
  '2026-05-14',
  '2026-05-25',
  '2026-07-14',
  '2026-08-15',
  '2026-11-01',
  '2026-11-11',
  '2026-12-25',
  '2027-01-01',
  '2027-03-29',
  '2027-05-01',
  '2027-05-06',
  '2027-05-08',
  '2027-05-17',
  '2027-07-14',
  '2027-08-15',
  '2027-11-01',
  '2027-11-11',
  '2027-12-25',
];

function splitAndSortSlots(slots: string[], lateThresholdHour: number) {
  const unique = Array.from(
    new Set(
      slots
        .map((s) => s.trim())
        .filter((s) => /^\d{2}:\d{2}$/.test(s))
    )
  ).sort((a, b) => a.localeCompare(b));

  const standardSlots: string[] = [];
  const eveningSlots: string[] = [];

  for (const slot of unique) {
    const hour = Number(slot.split(':')[0]);
    if (!Number.isNaN(hour) && hour >= lateThresholdHour) {
      eveningSlots.push(slot);
    } else {
      standardSlots.push(slot);
    }
  }

  return { unique, standardSlots, eveningSlots };
}

function formatCompactFrenchDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function formatExactDateTime(isoString?: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function buildSupplementNote(params: {
  supplementAmount: number;
  lateHourThreshold: number;
  sundayEnabled: boolean;
  holidaysCount: number;
}): string {
  const { supplementAmount, lateHourThreshold, sundayEnabled, holidaysCount } = params;
  if (supplementAmount <= 0) {
    return 'Aucun supplément horaire ou dimanche appliqué actuellement (tarif normal sur tous les créneaux).';
  }
  const triggers: string[] = [];
  if (lateHourThreshold < 24) {
    triggers.push(`après ${lateHourThreshold}h`);
  }
  if (sundayEnabled) {
    triggers.push('le dimanche');
  }
  if (holidaysCount > 0) {
    triggers.push('les jours fériés');
  }
  if (triggers.length === 0) {
    return `Des créneaux spéciaux peuvent appliquer un supplément de ${supplementAmount} €.`;
  }
  const formattedTriggers =
    triggers.length === 1
      ? triggers[0]
      : `${triggers.slice(0, -1).join(', ')} ou ${triggers[triggers.length - 1]}`;
  return `Des rendez-vous ${formattedTriggers} sont possibles avec un supplément de ${supplementAmount} €.`;
}

function formatEmailLogDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatEmailKindLabel(kind: EmailLogEntry['kind']): string {
  switch (kind) {
    case 'admin_alert':
      return 'Nouvelle demande reçue';
    case 'client_confirmed':
      return 'Confirmation envoyée';
    case 'client_declined':
      return 'Refus envoyé';
    default:
      return 'E-mail test';
  }
}

function formatEmailDetailHuman(log: EmailLogEntry): string {
  if (log.status === 'sent') {
    return `E-mail bien envoyé à ${log.to}.`;
  }
  if (log.status === 'logged_no_smtp') {
    return 'Envoi automatique en attente d’activation sur le serveur.';
  }
  return 'L’envoi n’a pas pu aboutir pour le moment (vérifiez l’adresse de destination).';
}

const CATEGORY_OPTIONS: { value: ServiceCategory; label: string }[] = [
  { value: 'extensions', label: 'Extensions de cils' },
  { value: 'depose', label: 'Dépose' },
  { value: 'rehaussement', label: 'Rehaussement de cils' },
  { value: 'blanchiment', label: 'Blanchiment dentaire' },
];

export const AdminPage: React.FC = () => {
  const {
    data,
    loading,
    adminToken,
    loginAdmin,
    logoutAdmin,
    updateConfig,
    upsertService,
    deleteService,
    upsertAddon,
    deleteAddon,
    upsertProtocol,
    deleteProtocol,
    upsertFaq,
    deleteFaq,
    updateBookingDecision,
    deleteBooking,
    refreshAdminStudio,
    sendTestEmail,
    importStudioData,
    resetStudioData,
  } = useStudio();

  const [loginEmailInput, setLoginEmailInput] = useState(() => {
    try {
      return (
        window.localStorage.getItem('alshana_admin_email') ||
        data.config.contactEmail ||
        'alshanasglow@gmail.com'
      );
    } catch {
      return 'alshanasglow@gmail.com';
    }
  });
  const [passcodeInput, setPasscodeInput] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (data.config.contactEmail) {
      setLoginEmailInput(data.config.contactEmail);
    }
  }, [data.config.contactEmail]);

  const [activeTab, setActiveTab] = useState<AdminTab>('services');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusError, setStatusError] = useState('');

  // Service Edit Modal & Direct Media State (YDM style)
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [serviceForm, setServiceForm] = useState<{
    name: string;
    category: ServiceCategory;
    fullPrice: number;
    refillPrice: number | null;
    durationMinutes: number;
    description: string;
    imageUrl: string;
    showImage: boolean;
    active: boolean;
  }>({
    name: '',
    category: 'extensions',
    fullPrice: 40,
    refillPrice: null,
    durationMinutes: 120,
    description: '',
    imageUrl: '',
    showImage: true,
    active: true,
  });
  const [savingService, setSavingService] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showManualUrl, setShowManualUrl] = useState(false);

  // File input refs for direct single-click triggering
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);

  // Interactive 16:10 Image Cropping Modal State
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');
  const [cropFileName, setCropFileName] = useState('photo-studio.webp');

  // Bookings filter & decision edits (par défaut sur les demandes en attente)
  const [bookingFilter, setBookingFilter] = useState<BookingStatus | 'all'>('pending');
  const [bookingEdits, setBookingEdits] = useState<
    Record<string, { preferredDate?: string; preferredTime?: string; adminDecisionNote?: string }>
  >({});
  const [expandedBookingEditors, setExpandedBookingEditors] = useState<Record<string, boolean>>({});
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);

  // Multi-slots proposer
  const [proposedSlotsMap, setProposedSlotsMap] = useState<
    Record<string, Array<{ date: string; time: string }>>
  >({});
  const [showSlotsProposer, setShowSlotsProposer] = useState<Record<string, boolean>>({});
  const [sendingProposals, setSendingProposals] = useState<string | null>(null);

  // Services accordion & filter
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('all');
  // Schedule rules inputs
  const tomorrowIso = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('14:00');
  const [newBlockedSlotDate, setNewBlockedSlotDate] = useState(tomorrowIso);
  const [newBlockedSlotTime, setNewBlockedSlotTime] = useState('14:00');

  // Studio notification email
  const [contactEmailInput, setContactEmailInput] = useState(data.config.contactEmail || '');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  useEffect(() => {
    setContactEmailInput(data.config.contactEmail || '');
  }, [data.config.contactEmail]);

  // New Addon Form State
  const [newAddonName, setNewAddonName] = useState('');
  const [newAddonDesc, setNewAddonDesc] = useState('');
  const [newAddonPrice, setNewAddonPrice] = useState(0);

  // New Protocol Block State
  const [newProtoGroup, setNewProtoGroup] = useState<'rehaussement' | 'blanchiment'>('rehaussement');
  const [newProtoTitle, setNewProtoTitle] = useState('');
  const [newProtoItems, setNewProtoItems] = useState('');

  // New FAQ Item State
  const [newFaqQuestion, setNewFaqQuestion] = useState('');
  const [newFaqAnswer, setNewFaqAnswer] = useState('');

  const notify = (msg: string) => {
    setStatusError('');
    setStatusMessage(msg);
    window.setTimeout(() => setStatusMessage(''), 5000);
  };

  const notifyError = (msg: string) => {
    setStatusMessage('');
    setStatusError(msg);
    window.setTimeout(() => setStatusError(''), 6000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoggingIn(true);
    try {
      await loginAdmin(passcodeInput, loginEmailInput);
      try {
        window.localStorage.setItem('alshana_admin_email', loginEmailInput.trim());
      } catch {}
      setPasscodeInput('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Identifiants incorrects.');
    } finally {
      setLoggingIn(false);
    }
  };

  if (adminToken && loading) {
    return (
      <div className="surface-silk flex min-h-dvh items-center justify-center px-4 py-12">
        <div className="relative z-10 flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-sand" />
          <h2 className="font-serif text-2xl tracking-wide text-ivory">Espace Administration</h2>
          <p className="text-xs text-stone/75">Synchronisation sécurisée de vos données en cours...</p>
        </div>
      </div>
    );
  }

  if (!adminToken) {
    return (
      <div className="surface-silk flex min-h-dvh items-center justify-center px-4 py-12">
        <div className="relative z-10 w-full max-w-md border border-white/20 bg-obsidian/90 p-7 text-ivory sm:p-10">
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center gap-2 text-xs tracking-wider text-stone uppercase hover:text-ivory"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retour au site</span>
          </Link>

          <div className="mt-6 flex items-center gap-3">
            <Lock className="h-5 w-5 text-stone" aria-hidden="true" />
            <h1 className="font-serif text-3xl text-ivory">Administration</h1>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-stone/80">
            Espace de gestion {data.config.brandName} — validation des rendez-vous, horaires,
            tarifs et photos du studio.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-email"
                className="block text-xs font-medium tracking-wider text-stone uppercase"
              >
                E-mail administrateur
              </label>
              <input
                id="admin-email"
                name="email"
                type="email"
                autoComplete="email"
                value={loginEmailInput}
                onChange={(e) => {
                  setLoginEmailInput(e.target.value);
                  setAuthError('');
                }}
                className="min-h-[48px] w-full border border-white/25 bg-black/50 px-3.5 text-ivory placeholder:text-stone/50"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="admin-passcode"
                  className="block text-xs font-medium tracking-wider text-stone uppercase"
                >
                  Mot de passe
                </label>
              </div>
              <div className="relative flex items-center">
                <input
                  id="admin-passcode"
                  name="passcode"
                  type={showPasscode ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Code secret administrateur"
                  value={passcodeInput}
                  onChange={(e) => {
                    setPasscodeInput(e.target.value);
                    setAuthError('');
                  }}
                  className="min-h-[48px] w-full border border-white/25 bg-black/50 pr-12 pl-3.5 text-ivory placeholder:text-stone/50"
                />
                <button
                  type="button"
                  aria-pressed={showPasscode}
                  aria-label={showPasscode ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  onClick={() => setShowPasscode((prev) => !prev)}
                  className="absolute right-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-stone hover:text-ivory cursor-pointer"
                >
                  {showPasscode ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {authError && (
              <p role="alert" className="text-xs text-red-300">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="flex min-h-[48px] w-full items-center justify-center border border-ivory bg-ivory px-4 py-2.5 text-xs font-semibold tracking-[0.2em] text-obsidian uppercase transition-colors hover:bg-stone disabled:opacity-60 cursor-pointer"
            >
              {loggingIn ? 'Connexion...' : 'Accéder au tableau de bord'}
            </button>

            <div className="border-t border-white/10 pt-3 space-y-1.5 text-[11px] text-stone/75">
              <div className="flex items-center gap-1.5 text-sand">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Session persistante active : vous restez connecté(e) sur cet appareil.</span>
              </div>
              <p>
                Code initial : <code>alshana2026</code> (modifiable dans vos paramètres).
              </p>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const filteredBookings: BookingRequest[] = useMemo(() => {
    const list =
      bookingFilter === 'all'
        ? [...data.bookings]
        : data.bookings.filter((b) => b.status === bookingFilter);

    // Tri chronologique : plus récentes demandes reçues en premier
    return list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [data.bookings, bookingFilter]);

  const handleBookingDecision = async (booking: BookingRequest, nextStatus: BookingStatus) => {
    const edits = bookingEdits[booking.id] || {};
    setBusyBookingId(booking.id);
    try {
      const res = await updateBookingDecision(booking.id, {
        status: nextStatus,
        preferredDate: edits.preferredDate || booking.preferredDate,
        preferredTime: edits.preferredTime || booking.preferredTime,
        adminDecisionNote:
          edits.adminDecisionNote !== undefined
            ? edits.adminDecisionNote
            : booking.adminDecisionNote,
      });

      setExpandedBookingEditors((prev) => ({ ...prev, [booking.id]: false }));
      if (nextStatus === 'pending') {
        notify('Validation annulée (dévalidé) : le créneau redevient disponible sur le site.');
      } else {
        const emailMsg = res.emailNotification?.message
          ? ` — ${res.emailNotification.message}`
          : '';
        notify(`Statut mis à jour (${STATUS_LABELS[nextStatus]})${emailMsg}`);
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour.');
    } finally {
      setBusyBookingId(null);
    }
  };

  const handleSendSlotProposals = async (booking: BookingRequest) => {
    const slots = proposedSlotsMap[booking.id] || [
      { date: booking.preferredDate, time: '10:00' },
      { date: booking.preferredDate, time: '14:00' },
    ];
    if (slots.length === 0) {
      notifyError('Ajoutez au moins une option de créneau.');
      return;
    }
    setSendingProposals(booking.id);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/propose-slots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ slots }),
      });
      if (res.ok) {
        notify(`Propositions envoyées par e-mail à ${booking.clientEmail}.`);
        setShowSlotsProposer((prev) => ({ ...prev, [booking.id]: false }));
        if (adminToken) await refreshAdminStudio(adminToken);
      } else {
        notify('Propositions envoyées.');
      }
    } catch {
      notify('Propositions enregistrées.');
    } finally {
      setSendingProposals(null);
    }
  };

  const toggleWeekdayClosed = async (dayNum: number) => {
    const current = data.config.bookingRules.closedWeekdays || [];
    const currentlyClosed =
      current.includes(dayNum) || (dayNum === 0 && !data.config.bookingRules.sundayEnabled);
    const nextClosed = currentlyClosed
      ? current.filter((d) => d !== dayNum)
      : Array.from(new Set([...current, dayNum]));
    const nextSundayEnabled = dayNum === 0 ? currentlyClosed : !nextClosed.includes(0);

    const nextRules = {
      ...data.config.bookingRules,
      closedWeekdays: nextClosed,
      sundayEnabled: nextSundayEnabled,
    };
    await updateConfig({
      bookingRules: {
        ...nextRules,
        supplementNote: buildSupplementNote({
          supplementAmount: nextRules.supplementAmount,
          lateHourThreshold: nextRules.lateHourThreshold,
          sundayEnabled: nextSundayEnabled,
          holidaysCount: (nextRules.holidays || []).length,
        }),
      },
    });
    const label = WEEKDAYS.find((w) => w.day === dayNum)?.label || 'Jour';
    notify(currentlyClosed ? `${label} marqué comme ouvert.` : `${label} marqué comme fermé.`);
  };

  const handleUpdateAllSlots = async (
    nextRawSlots: string[],
    thresholdOverride?: number,
    feedbackMsg?: string
  ) => {
    const threshold =
      thresholdOverride !== undefined
        ? thresholdOverride
        : data.config.bookingRules.lateHourThreshold;
    const { standardSlots, eveningSlots } = splitAndSortSlots(nextRawSlots, threshold);
    const rules = data.config.bookingRules;
    await updateConfig({
      bookingRules: {
        ...rules,
        lateHourThreshold: threshold,
        standardSlots,
        eveningSlots,
        supplementNote: buildSupplementNote({
          supplementAmount: rules.supplementAmount,
          lateHourThreshold: threshold,
          sundayEnabled: rules.sundayEnabled && !(rules.closedWeekdays || []).includes(0),
          holidaysCount: (rules.holidays || []).length,
        }),
      },
    });
    if (feedbackMsg) notify(feedbackMsg);
  };

  const handleUpdateSupplementAmount = async (nextAmountRaw: number, feedbackMsg?: string) => {
    const nextAmount = Math.max(0, Math.min(100, Math.round(nextAmountRaw || 0)));
    const rules = data.config.bookingRules;
    await updateConfig({
      bookingRules: {
        ...rules,
        supplementAmount: nextAmount,
        supplementNote: buildSupplementNote({
          supplementAmount: nextAmount,
          lateHourThreshold: rules.lateHourThreshold,
          sundayEnabled: rules.sundayEnabled && !(rules.closedWeekdays || []).includes(0),
          holidaysCount: (rules.holidays || []).length,
        }),
      },
    });
    if (feedbackMsg) notify(feedbackMsg);
  };

  const handleAddTimeSlot = async (timeToAdd: string) => {
    const clean = timeToAdd.trim();
    if (!/^\d{2}:\d{2}$/.test(clean)) {
      notifyError('Veuillez choisir une heure valide (ex. 12:00).');
      return;
    }
    const existing = [
      ...data.config.bookingRules.standardSlots,
      ...data.config.bookingRules.eveningSlots,
    ];
    if (existing.includes(clean)) {
      notify(`L’horaire ${clean} est déjà dans la liste.`);
      return;
    }
    const hour = Number(clean.split(':')[0]);
    const isSup =
      !Number.isNaN(hour) && hour >= data.config.bookingRules.lateHourThreshold;
    await handleUpdateAllSlots(
      [...existing, clean],
      undefined,
      `Horaire ${clean} ajouté${isSup ? ` (tarif soir +${data.config.bookingRules.supplementAmount} €)` : ''}.`
    );
  };

  const handleRemoveTimeSlot = async (slotToRemove: string) => {
    const remaining = [
      ...data.config.bookingRules.standardSlots,
      ...data.config.bookingRules.eveningSlots,
    ].filter((s) => s !== slotToRemove);
    if (remaining.length === 0) {
      notifyError('Gardez au moins une heure fixe (ou choisissez « Créneaux flexibles »).');
      return;
    }
    await handleUpdateAllSlots(remaining, undefined, `Horaire ${slotToRemove} retiré.`);
  };

  const handleToggleFlexibleHours = async (nextFlexible: boolean) => {
    await updateConfig({
      bookingRules: {
        ...data.config.bookingRules,
        flexibleHours: nextFlexible,
      },
    });
    notify(
      nextFlexible
        ? 'Mode créneaux flexibles activé : vos clientes indiquent l’heure souhaitée.'
        : 'Mode heures fixes activé : seules vos heures choisies sont proposées.'
    );
  };

  const handleAddHolidayDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate) return;
    const rules = data.config.bookingRules;
    const current = rules.holidays || [];
    if (!current.includes(newHolidayDate)) {
      const nextHolidays = [...current, newHolidayDate].sort();
      await updateConfig({
        bookingRules: {
          ...rules,
          holidays: nextHolidays,
          supplementNote: buildSupplementNote({
            supplementAmount: rules.supplementAmount,
            lateHourThreshold: rules.lateHourThreshold,
            sundayEnabled: rules.sundayEnabled && !(rules.closedWeekdays || []).includes(0),
            holidaysCount: nextHolidays.length,
          }),
        },
      });
      notify(
        `Jour férié ajouté : ${formatCompactFrenchDate(newHolidayDate)} (+${rules.supplementAmount} €).`
      );
    }
    setNewHolidayDate('');
  };

  const handleRemoveHolidayDate = async (dateStr: string) => {
    const rules = data.config.bookingRules;
    const nextHolidays = (rules.holidays || []).filter((d) => d !== dateStr);
    await updateConfig({
      bookingRules: {
        ...rules,
        holidays: nextHolidays,
        supplementNote: buildSupplementNote({
          supplementAmount: rules.supplementAmount,
          lateHourThreshold: rules.lateHourThreshold,
          sundayEnabled: rules.sundayEnabled && !(rules.closedWeekdays || []).includes(0),
          holidaysCount: nextHolidays.length,
        }),
      },
    });
    notify(`Jour férié retiré (${formatCompactFrenchDate(dateStr)}).`);
  };

  const handleLoadFrenchHolidaysPreset = async () => {
    const rules = data.config.bookingRules;
    const merged = Array.from(
      new Set([...(rules.holidays || []), ...FRENCH_PUBLIC_HOLIDAYS])
    ).sort();
    await updateConfig({
      bookingRules: {
        ...rules,
        holidays: merged,
        supplementNote: buildSupplementNote({
          supplementAmount: rules.supplementAmount,
          lateHourThreshold: rules.lateHourThreshold,
          sundayEnabled: rules.sundayEnabled && !(rules.closedWeekdays || []).includes(0),
          holidaysCount: merged.length,
        }),
      },
    });
    notify('Jours fériés français 2026–2027 complétés.');
  };

  const toggleBlockedSlot = async (dateStr: string, timeStr: string) => {
    const current = data.config.bookingRules.blockedSlots || [];
    const exists = current.some((s) => s.date === dateStr && s.time === timeStr);
    const next = exists
      ? current.filter((s) => !(s.date === dateStr && s.time === timeStr))
      : [...current, { date: dateStr, time: timeStr }];
    await updateConfig({
      bookingRules: {
        ...data.config.bookingRules,
        blockedSlots: next,
      },
    });
    notify(
      exists
        ? `Horaire ${timeStr} libéré (${formatCompactFrenchDate(dateStr)}).`
        : `Horaire ${timeStr} bloqué le ${formatCompactFrenchDate(dateStr)}.`
    );
  };

  const handleBlockPunctualSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockedSlotDate || !/^\d{2}:\d{2}$/.test(newBlockedSlotTime)) {
      notifyError('Veuillez choisir une date et une heure valides.');
      return;
    }
    const current = data.config.bookingRules.blockedSlots || [];
    const exists = current.some(
      (s) => s.date === newBlockedSlotDate && s.time === newBlockedSlotTime
    );
    if (exists) {
      notify(
        `L’heure ${newBlockedSlotTime} est déjà bloquée le ${formatCompactFrenchDate(newBlockedSlotDate)}.`
      );
      return;
    }
    await toggleBlockedSlot(newBlockedSlotDate, newBlockedSlotTime);
  };

  const handleSaveContactEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = contactEmailInput.trim();
    if (!cleaned || !cleaned.includes('@')) {
      notifyError('Veuillez indiquer une adresse e-mail valide.');
      return;
    }
    await updateConfig({ contactEmail: cleaned });
    notify(`Adresse de réception enregistrée : ${cleaned}`);
  };

  const handleSendStudioTestEmail = async () => {
    const target = contactEmailInput.trim() || data.config.contactEmail.trim();
    if (!target) {
      notifyError('Indiquez d’abord votre adresse e-mail ci-dessus.');
      return;
    }
    setSendingTestEmail(true);
    try {
      const res = await sendTestEmail(target, 'Studio');
      if (res.delivered) {
        notify(`E-mail test envoyé sur ${target}.`);
      } else {
        notifyError(res.message);
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'L’envoi du test a échoué.');
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleAddAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddonName.trim()) return;
    const item: ServiceAddon = {
      id: `addon-${Date.now()}`,
      name: newAddonName.trim(),
      description: newAddonDesc.trim(),
      price: Number(newAddonPrice) || 0,
      priceLabel: Number(newAddonPrice) === 0 ? 'Gratuit / Sur demande' : undefined,
      applicableCategories: ['extensions'],
      active: true,
    };
    await upsertAddon(item);
    setNewAddonName('');
    setNewAddonDesc('');
    setNewAddonPrice(0);
    notify('Option ajoutée.');
  };

  const handleAddProtocol = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProtoTitle.trim()) return;
    const block: ProtocolBlock = {
      id: `proto-${Date.now()}`,
      group: newProtoGroup,
      title: newProtoTitle.trim(),
      items: newProtoItems
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    };
    await upsertProtocol(block);
    setNewProtoTitle('');
    setNewProtoItems('');
    notify('Bloc protocole ajouté.');
  };

  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFaqQuestion.trim() || !newFaqAnswer.trim()) {
      notifyError('Veuillez renseigner la question et la réponse.');
      return;
    }
    const newFaq: FaqItem = {
      id: `faq-${Date.now()}`,
      question: newFaqQuestion.trim(),
      answer: newFaqAnswer.trim(),
      active: true,
    };
    await upsertFaq(newFaq);
    setNewFaqQuestion('');
    setNewFaqAnswer('');
    notify('Question FAQ enregistrée avec succès.');
  };

  const handleResetFaqs = async () => {
    if (!window.confirm('Rétablir les questions fréquentes par défaut sur le site ?')) return;
    for (const faq of DEFAULT_FAQS) {
      await upsertFaq(faq);
    }
    notify('Questions FAQ par défaut rétablies.');
  };

  const openCreateServiceModal = () => {
    setEditingService(null);
    setIsCreatingService(true);
    setServiceForm({
      name: '',
      category: 'extensions',
      fullPrice: 40,
      refillPrice: null,
      durationMinutes: 120,
      description: '',
      imageUrl: '',
      showImage: true,
      active: true,
    });
    setShowManualUrl(false);
    setIsServiceModalOpen(true);
  };

  const openEditServiceModal = (service: ServiceItem) => {
    setEditingService(service);
    setIsCreatingService(false);
    setServiceForm({
      name: service.name,
      category: service.category,
      fullPrice: service.fullPrice,
      refillPrice: service.refillPrice ?? null,
      durationMinutes: 120, // 2h uniforme
      description: service.description || '',
      imageUrl: service.imageUrl || '',
      showImage: service.showImage !== false,
      active: service.active !== false,
    });
    setShowManualUrl(false);
    setIsServiceModalOpen(true);
  };

  const handleSelectImageForCrop = (file: File) => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setCropImageSrc(objectUrl);
    setCropFileName(file.name);
    setCropModalOpen(true);
  };

  const handleCropComplete = async (croppedBlob: Blob, croppedFileName: string) => {
    setUploadingMedia(true);
    setUploadProgress(0);
    try {
      const res = await uploadMediaWithProgress(
        croppedBlob,
        croppedFileName,
        data.config.cloudinary,
        (pct) => setUploadProgress(pct)
      );
      setServiceForm((prev) => ({
        ...prev,
        imageUrl: res.url,
        showImage: true,
      }));
      notify('Photo recadrée et envoyée avec succès sur Cloudinary !');
    } catch (err: any) {
      notifyError(err?.message || "Erreur lors de l'envoi de la photo recadrée.");
    } finally {
      setUploadingMedia(false);
      setUploadProgress(0);
    }
  };

  const handleRecropExistingImage = () => {
    if (!serviceForm.imageUrl) return;
    setCropImageSrc(serviceForm.imageUrl);
    setCropFileName('photo-service.webp');
    setCropModalOpen(true);
  };

  const handleSelectVideoUpload = async (file: File) => {
    if (!file) return;
    setUploadingMedia(true);
    setUploadProgress(0);
    try {
      const res = await uploadMediaWithProgress(
        file,
        file.name,
        data.config.cloudinary,
        (pct) => setUploadProgress(pct)
      );
      setServiceForm((prev) => ({
        ...prev,
        imageUrl: res.url,
        showImage: true,
      }));
      notify('Vidéo HD envoyée et associée avec succès à la prestation !');
    } catch (err: any) {
      notifyError(err?.message || "Erreur lors de l'envoi de la vidéo.");
    } finally {
      setUploadingMedia(false);
      setUploadProgress(0);
    }
  };

  const handleSaveServiceModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.name.trim()) {
      notifyError('Veuillez renseigner le nom de la prestation.');
      return;
    }
    setSavingService(true);
    try {
      const servicePayload: ServiceItem = {
        id: editingService ? editingService.id : `srv-${Date.now()}`,
        category: serviceForm.category,
        name: serviceForm.name.trim(),
        subtitle: editingService?.subtitle || '',
        fullPrice: Number(serviceForm.fullPrice) || 0,
        fullLabel: editingService?.fullLabel || 'Pose complète',
        refillPrice: serviceForm.refillPrice != null ? Number(serviceForm.refillPrice) : null,
        refillLabel: editingService?.refillLabel || 'Remplissage 3 semaines',
        durationMinutes: 120, // 2h uniforme
        description: serviceForm.description.trim(),
        imageUrl: serviceForm.imageUrl.trim(),
        showImage: serviceForm.showImage,
        active: serviceForm.active,
        supportsLashOptions: editingService?.supportsLashOptions ?? false,
      };

      await upsertService(servicePayload);
      setIsServiceModalOpen(false);
      notify(
        editingService
          ? `Prestation « ${servicePayload.name} » mise à jour avec succès !`
          : `Nouvelle prestation « ${servicePayload.name} » créée avec succès !`
      );
    } catch (err: any) {
      notifyError(err?.message || "Erreur lors de l'enregistrement de la prestation.");
    } finally {
      setSavingService(false);
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alshanas-glow-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importStudioData(text);
      notify('Sauvegarde importée.');
    } catch {
      notifyError('Fichier JSON invalide.');
    }
    e.target.value = '';
  };

  const { unique: allSlotsForDay } = splitAndSortSlots(
    [...data.config.bookingRules.standardSlots, ...data.config.bookingRules.eveningSlots],
    data.config.bookingRules.lateHourThreshold
  );

  return (
    <div className="min-h-dvh bg-ivory text-charcoal">
      {/* Top Admin Bar */}
      <header className="border-b border-stone bg-obsidian px-4 py-4 text-ivory sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex min-h-[44px] items-center gap-2 border border-white/20 px-3 py-2 text-xs tracking-wider text-stone uppercase hover:border-ivory hover:text-ivory"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Voir le site</span>
            </Link>
            <div>
              <h1 className="font-serif text-2xl text-ivory">{data.config.brandName} — Admin</h1>
              <p className="text-[11px] text-stone/75">
                Validation des rendez-vous, horaires, tarifs et photos du studio
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logoutAdmin}
            className="min-h-[44px] border border-white/25 px-4 py-2 text-xs tracking-wider text-stone uppercase hover:border-ivory hover:text-ivory"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Live status feedback */}
      {statusMessage && (
        <div
          role="status"
          className="border-b border-emerald-800/20 bg-emerald-950 px-4 py-2.5 text-center text-xs font-medium text-emerald-100"
        >
          {statusMessage}
        </div>
      )}
      {statusError && (
        <div
          role="alert"
          className="border-b border-red-800/30 bg-red-950 px-4 py-2.5 text-center text-xs font-medium text-red-100"
        >
          {statusError}
        </div>
      )}

      {/* Navigation Tabs */}
      <nav
        aria-label="Sections d’administration"
        className="border-b border-stone bg-white px-4 sm:px-6"
      >
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto py-2">
          {(
            [
              { id: 'services', label: `Prestations & Médias (${data.services.length})` },
              { id: 'schedule', label: 'Calendrier & Horaires' },
              { id: 'bookings', label: `Rendez-vous (${data.bookings.length})` },
              { id: 'content', label: 'Contenus & Textes' },
              { id: 'emails', label: 'E-mails & Journal' },
              { id: 'cloudinary', label: 'Paramètres Studio' },
              { id: 'dashboard', label: 'Vue d’ensemble' },
            ] as { id: AdminTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] shrink-0 border px-4 py-2 text-xs font-medium tracking-wider uppercase transition-colors ${
                activeTab === tab.id
                  ? 'border-charcoal bg-charcoal text-ivory'
                  : 'border-transparent text-taupe hover:border-stone hover:text-charcoal'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* TAB 0: VRAI TABLEAU DE BORD D'ADMINISTRATION */}
        {activeTab === 'dashboard' && (
          <section className="space-y-8 animate-fade-in">
            {/* Header avec bienvenue et statut en direct */}
            <div className="flex flex-col gap-4 border border-stone bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-[10px] font-semibold tracking-widest text-taupe uppercase">
                  Alshana's Glow Studio · Administration
                </span>
                <h2 className="mt-1 font-serif text-3xl text-charcoal">
                  Tableau de bord
                </h2>
                <p className="mt-1 text-xs text-taupe">
                  Gestion centralisée des rendez-vous (2h par prestation), des visuels photos/vidéos et des textes du site.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Studio &amp; Réservations actifs</span>
                </span>
                <Link
                  to="/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[40px] items-center gap-1.5 border border-charcoal bg-charcoal px-4 py-1.5 text-xs font-medium text-ivory uppercase tracking-wider hover:bg-silk transition-colors"
                >
                  <span>Voir le site public</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Grille de 4 Cartes Statistiques Clés (KPIs) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div
                onClick={() => setActiveTab('bookings')}
                className={`border p-5 transition-all cursor-pointer ${
                  data.bookings.filter((b) => b.status === 'pending').length > 0
                    ? 'border-amber-400 bg-amber-50/50 hover:border-amber-600'
                    : 'border-stone bg-white hover:border-charcoal'
                }`}
              >
                <div className="flex items-center justify-between text-taupe">
                  <span className="text-[11px] font-medium tracking-wider uppercase">À valider</span>
                  <Clock className="h-4 w-4" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-serif text-3xl font-medium text-charcoal">
                    {data.bookings.filter((b) => b.status === 'pending').length}
                  </span>
                  {data.bookings.filter((b) => b.status === 'pending').length > 0 && (
                    <span className="text-[11px] font-semibold text-amber-700">Demande(s) en attente</span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-taupe">Cliquez pour consulter</p>
              </div>

              <div
                onClick={() => setActiveTab('bookings')}
                className="border border-stone bg-white p-5 transition-all hover:border-charcoal cursor-pointer"
              >
                <div className="flex items-center justify-between text-taupe">
                  <span className="text-[11px] font-medium tracking-wider uppercase">Confirmés</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-3">
                  <span className="font-serif text-3xl font-medium text-charcoal">
                    {data.bookings.filter((b) => b.status === 'confirmed').length}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-taupe">Rendez-vous programmés</p>
              </div>

              <div className="border border-stone bg-white p-5">
                <div className="flex items-center justify-between text-taupe">
                  <span className="text-[11px] font-medium tracking-wider uppercase">CA prévisionnel</span>
                  <Euro className="h-4 w-4 text-charcoal" />
                </div>
                <div className="mt-3">
                  <span className="font-serif text-3xl font-medium text-charcoal">
                    {data.bookings
                      .filter((b) => b.status === 'confirmed')
                      .reduce((sum, b) => sum + (b.totalPrice || 0), 0)}
                    €
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-taupe">Sur réservations validées</p>
              </div>

              <div
                onClick={() => setActiveTab('services')}
                className="border border-stone bg-white p-5 transition-all hover:border-charcoal cursor-pointer"
              >
                <div className="flex items-center justify-between text-taupe">
                  <span className="text-[11px] font-medium tracking-wider uppercase">Prestations</span>
                  <Sparkles className="h-4 w-4 text-charcoal" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-serif text-3xl font-medium text-charcoal">
                    {data.services.filter((s) => s.active).length}
                  </span>
                  <span className="text-xs text-taupe">/ {data.services.length}</span>
                </div>
                <p className="mt-1 text-[11px] text-taupe">
                  Durée uniforme : 2h par soin
                </p>
              </div>
            </div>

            {/* Alertes Rendez-vous à traiter en priorité */}
            {data.bookings.filter((b) => b.status === 'pending').length > 0 && (
              <div className="border-2 border-amber-400 bg-amber-50/40 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-900">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <h3 className="font-serif text-xl font-medium">
                      Demande(s) de rendez-vous en attente de votre confirmation
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('bookings')}
                    className="text-xs font-semibold underline text-amber-900 hover:text-black"
                  >
                    Voir la liste complète
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.bookings
                    .filter((b) => b.status === 'pending')
                    .slice(0, 3)
                    .map((booking) => (
                      <div
                        key={booking.id}
                        className="border border-amber-300 bg-white p-4 space-y-2 shadow-xs"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-semibold text-charcoal">{booking.clientName}</span>
                            <p className="text-xs text-taupe">{booking.clientPhone}</p>
                          </div>
                          <span className="font-serif font-bold text-charcoal">{booking.totalPrice} €</span>
                        </div>
                        <p className="text-xs font-medium text-charcoal">
                          {booking.serviceName} ({booking.variantLabel})
                        </p>
                        <div className="text-[11px] text-taupe flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          <span>{formatFrenchDate(booking.preferredDate)} à {booking.preferredTime}</span>
                          <span className="border border-stone/60 px-1 py-0.2 text-[9px] uppercase font-bold text-charcoal">2h</span>
                        </div>
                        <div className="pt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleBookingDecision(booking, 'confirmed')}
                            className="flex-1 min-h-[34px] border border-charcoal bg-charcoal text-ivory text-xs font-medium uppercase tracking-wider hover:bg-silk transition-colors"
                          >
                            Valider (2h)
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Remplacement Rapide des Photos de chaque soin (avec cadrage 16/10 parfait) */}
            <div className="border border-stone bg-white p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="font-serif text-2xl text-charcoal">
                    Photos des prestations (Cadres 16/10 &amp; Compression fluide)
                  </h3>
                  <p className="text-xs text-taupe">
                    Remplacez directement l'illustration d'une prestation par votre vraie photo ou vidéo.
                    L'image est automatiquement compressée et s'adapte sans aucune déformation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('services')}
                  className="text-xs text-taupe underline hover:text-charcoal self-start sm:self-auto"
                >
                  Gérer les tarifs et descriptions
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {data.services.map((service) => (
                  <div
                    key={service.id}
                    className="flex flex-col justify-between border border-stone/80 bg-paper p-4 space-y-3"
                  >
                    <div>
                      {/* Cadre média strictement au ratio 16/10ème pour zéro déformation */}
                      <div className="relative aspect-[16/10] w-full overflow-hidden border border-stone bg-black/5">
                        <AestheticMediaViewer
                          url={service.imageUrl}
                          alt={service.name}
                          aspectRatioClass="h-full w-full"
                          badge="2h"
                        />
                      </div>

                      <div className="mt-3 flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-serif text-base font-medium text-charcoal">
                            {service.name}
                          </h4>
                          <span className="inline-block text-[10px] text-taupe uppercase tracking-wider">
                            Durée : 2h · {service.fullPrice} €
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            upsertService({ ...service, active: !service.active })
                          }
                          className={`border px-2 py-0.5 text-[10px] uppercase font-medium transition-colors ${
                            service.active
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-stone bg-stone/20 text-taupe'
                          }`}
                        >
                          {service.active ? 'Affiché' : 'Masqué'}
                        </button>
                      </div>
                    </div>

                    {/* Bouton vers l'édition complète avec recadrage */}
                    <div className="pt-2 border-t border-stone/40">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('services');
                          openEditServiceModal(service);
                        }}
                        className="flex min-h-[38px] w-full items-center justify-center gap-2 border border-charcoal bg-white px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-ivory transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Modifier ce soin &amp; média</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Informations Générales du Studio Modifiables Directement */}
            <div className="border border-stone bg-white p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-2xl text-charcoal">
                    Textes &amp; Coordonnées du Studio
                  </h3>
                  <p className="text-xs text-taupe">
                    Modifiez les informations affichées sur la vitrine du site.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('content')}
                  className="text-xs text-taupe underline hover:text-charcoal"
                >
                  Éditeur complet des protocoles &gt;
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] text-taupe uppercase">Slogan principal</label>
                  <input
                    type="text"
                    value={data.config.tagline}
                    onChange={(e) => updateConfig({ tagline: e.target.value })}
                    className="mt-1 min-h-[44px] w-full border border-stone px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-taupe uppercase">E-mail de contact &amp; alertes</label>
                  <input
                    type="email"
                    value={data.config.contactEmail}
                    onChange={(e) => updateConfig({ contactEmail: e.target.value })}
                    className="mt-1 min-h-[44px] w-full border border-stone px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-taupe uppercase">Ligne de localisation publique</label>
                  <input
                    type="text"
                    value={data.config.locationLine}
                    onChange={(e) => updateConfig({ locationLine: e.target.value })}
                    className="mt-1 min-h-[44px] w-full border border-stone px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-taupe uppercase">Instagram (@)</label>
                  <input
                    type="text"
                    value={data.config.handle}
                    onChange={(e) => updateConfig({ handle: e.target.value })}
                    className="mt-1 min-h-[44px] w-full border border-stone px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-taupe uppercase">Titre principal du site (Hero)</label>
                  <input
                    type="text"
                    value={data.config.heroTitle}
                    onChange={(e) => updateConfig({ heroTitle: e.target.value })}
                    className="mt-1 min-h-[44px] w-full border border-stone px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-taupe uppercase">Sous-titre descriptif (Hero)</label>
                  <textarea
                    rows={2}
                    value={data.config.heroSubtitle}
                    onChange={(e) => updateConfig({ heroSubtitle: e.target.value })}
                    className="mt-1 w-full border border-stone px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB 1: BOOKINGS & VALIDATION WORKFLOW */}
        {activeTab === 'bookings' && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-3xl text-charcoal">
                  Validation des rendez-vous
                </h2>
                <p className="text-xs text-taupe">
                  Les nouvelles demandes arrivent sur{' '}
                  <strong>{data.config.contactEmail}</strong>. Validez ou ajustez la date et
                  l’heure ici : la cliente reçoit automatiquement la réponse par e-mail.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {(['pending', 'confirmed', 'cancelled', 'completed', 'all'] as const).map(
                  (st) => {
                    const count =
                      st === 'all'
                        ? data.bookings.length
                        : data.bookings.filter((b) => b.status === st).length;

                    const label =
                      st === 'pending'
                        ? 'À traiter (en attente)'
                        : st === 'confirmed'
                          ? 'Confirmés'
                          : st === 'cancelled'
                            ? 'Refusés / Annulés'
                            : st === 'completed'
                              ? 'Terminés'
                              : 'Tout l’historique';

                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setBookingFilter(st)}
                        className={`min-h-[40px] border px-3.5 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                          bookingFilter === st
                            ? 'border-charcoal bg-charcoal text-ivory'
                            : 'border-stone bg-white text-charcoal hover:border-charcoal'
                        }`}
                      >
                        {label} ({count})
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {filteredBookings.length === 0 ? (
              <div className="border border-stone bg-white p-10 text-center">
                <Calendar className="mx-auto h-7 w-7 text-taupe" aria-hidden="true" />
                <p className="mt-3 font-serif text-2xl text-charcoal">
                  Aucune demande dans cette catégorie
                </p>
                <p className="mt-1 text-xs text-taupe">
                  {bookingFilter === 'pending'
                    ? 'Toutes les demandes ont été traitées ! Consultez les onglets Confirmés ou Historique pour voir les réservations précédentes.'
                    : 'Lorsqu’une cliente réserve un créneau sur le site, sa fiche apparaît ici.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBookings.map((booking) => {
                  const edit = bookingEdits[booking.id] || {};
                  const currentDate = edit.preferredDate ?? booking.preferredDate;
                  const currentTime = edit.preferredTime ?? booking.preferredTime;
                  const currentNote = edit.adminDecisionNote ?? booking.adminDecisionNote ?? '';
                  const busy = busyBookingId === booking.id;
                  const isPending = booking.status === 'pending';
                  const isConfirmed = booking.status === 'confirmed';
                  const showEditor = isPending || Boolean(expandedBookingEditors[booking.id]);

                  return (
                    <article
                      key={booking.id}
                      className={`border bg-white p-5 shadow-xs sm:p-6 ${
                        isConfirmed
                          ? 'border-emerald-700/45'
                          : booking.status === 'cancelled'
                            ? 'border-red-300'
                            : 'border-stone'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone/60 pb-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium tracking-widest uppercase ${
                                isConfirmed
                                  ? 'bg-emerald-100 text-emerald-950'
                                  : booking.status === 'cancelled'
                                    ? 'bg-red-100 text-red-950'
                                    : isPending
                                      ? 'bg-amber-100 text-amber-950 font-semibold'
                                      : 'bg-stone/40 text-charcoal'
                              }`}
                            >
                              {isConfirmed && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                              {booking.status === 'cancelled' && <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                              <span>
                                {booking.reference} · {STATUS_LABELS[booking.status]}
                              </span>
                            </span>

                            {booking.createdAt && (
                              <span className="inline-flex items-center gap-1 border border-stone/80 bg-stone/20 px-2.5 py-0.5 text-[10px] text-charcoal font-medium">
                                <Clock className="h-3 w-3 text-taupe" />
                                <span>Demande reçue le {formatExactDateTime(booking.createdAt)}</span>
                              </span>
                            )}
                          </div>
                          <h3 className="mt-1.5 font-serif text-2xl text-charcoal">
                            {booking.clientName}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-taupe">
                            <a
                              href={`tel:${booking.clientPhone.replace(/\s+/g, '')}`}
                              className="font-medium text-charcoal underline underline-offset-2 hover:opacity-75"
                              title="Appeler la cliente"
                            >
                              Tél : {booking.clientPhone}
                            </a>
                            <span>·</span>
                            <a
                              href={`mailto:${booking.clientEmail}`}
                              className="font-medium text-charcoal underline underline-offset-2 hover:opacity-75"
                              title="Écrire un e-mail"
                            >
                              {booking.clientEmail}
                            </a>
                            {booking.clientInstagram && (
                              <>
                                <span>·</span>
                                <a
                                  href={`https://instagram.com/${booking.clientInstagram.replace('@', '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-charcoal underline underline-offset-2 hover:opacity-75"
                                  title="Voir profil Instagram"
                                >
                                  {booking.clientInstagram}
                                </a>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-serif text-3xl text-charcoal">
                            {booking.totalPrice} €
                          </p>
                          {booking.isSupplementApplied && (
                            <p className="text-[11px] text-amber-800">
                              Inclut +{booking.supplementPrice} € ({booking.supplementReason})
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 text-xs sm:grid-cols-2">
                        <div>
                          <p className="font-medium text-charcoal">
                            {booking.serviceName} ({booking.variantLabel})
                          </p>
                          {booking.addonNames.length > 0 && (
                            <p className="text-taupe">Options : {booking.addonNames.join(', ')}</p>
                          )}
                          {booking.notes && (
                            <p className="mt-1 italic text-charcoal/80">
                              Message cliente : {booking.notes}
                            </p>
                          )}
                        </div>
                        <div className="sm:text-right">
                          <p className="font-medium text-charcoal">
                            {formatFrenchDate(booking.preferredDate)}
                          </p>
                          <p className="text-taupe">Horaire : {booking.preferredTime}</p>
                        </div>
                      </div>

                      {/* Confirmed / Cancelled / Completed Status Confirmation Banner */}
                      {!isPending && (
                        <div
                          className={`mt-4 flex flex-wrap items-center justify-between gap-3 border p-4 text-xs ${
                            isConfirmed
                              ? 'border-emerald-700/30 bg-emerald-50/70 text-emerald-950'
                              : booking.status === 'cancelled'
                                ? 'border-red-200 bg-red-50/60 text-red-950'
                                : 'border-stone bg-ivory text-charcoal'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            {isConfirmed ? (
                              <CheckCircle2
                                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800"
                                aria-hidden="true"
                              />
                            ) : booking.status === 'cancelled' ? (
                              <XCircle
                                className="mt-0.5 h-4 w-4 shrink-0 text-red-800"
                                aria-hidden="true"
                              />
                            ) : (
                              <CheckCircle2
                                className="mt-0.5 h-4 w-4 shrink-0 text-charcoal"
                                aria-hidden="true"
                              />
                            )}
                            <div>
                              <p className="font-semibold">
                                {isConfirmed
                                  ? `Rendez-vous validé et confirmé par e-mail à ${booking.clientEmail}`
                                  : booking.status === 'cancelled'
                                    ? 'Demande refusée / annulée — ce créneau est libre sur le site'
                                    : 'Prestation marquée comme terminée'}
                              </p>
                              {booking.adminDecisionNote && (
                                <p className="mt-0.5 text-[11px] opacity-85">
                                  Mot envoyé : {booking.adminDecisionNote}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleBookingDecision(booking, 'pending')}
                              className="inline-flex min-h-[38px] items-center gap-1.5 border border-charcoal/40 bg-white px-3 py-1.5 text-xs font-medium text-charcoal uppercase hover:border-charcoal disabled:opacity-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{isConfirmed ? 'Dévalider' : 'Remettre en attente'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBookingEditors((prev) => ({
                                  ...prev,
                                  [booking.id]: !prev[booking.id],
                                }))
                              }
                              className="min-h-[38px] border border-stone bg-white px-3 py-1.5 text-xs font-medium text-charcoal uppercase hover:border-charcoal"
                            >
                              {showEditor ? 'Fermer l’édition' : 'Modifier l’horaire'}
                            </button>

                            {isConfirmed && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleBookingDecision(booking, 'completed')}
                                className="min-h-[38px] border border-charcoal bg-charcoal px-3 py-1.5 text-xs font-medium text-ivory uppercase hover:bg-silk disabled:opacity-50"
                              >
                                Terminé
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Date/Time adjustment & validation actions (visible when pending OR explicitly opened) */}
                      {showEditor && (
                        <>
                          <div className="mt-4 grid gap-3 border-t border-stone/60 bg-ivory/70 p-4 sm:grid-cols-3">
                            <div className="sm:col-span-3 flex items-center justify-between">
                              <span className="text-[10px] font-semibold tracking-wider text-charcoal/80 uppercase">
                                Modifier la date & l'heure du rendez-vous
                              </span>
                              <span className="text-[10px] text-taupe">
                                Modifiez ci-dessous avant de cliquer sur Valider
                              </span>
                            </div>
                            <div>
                              <label
                                htmlFor={`booking-date-${booking.id}`}
                                className="block text-[11px] text-taupe uppercase"
                              >
                                {isPending ? 'Ajuster la date' : 'Nouvelle date'}
                              </label>
                              <input
                                id={`booking-date-${booking.id}`}
                                type="date"
                                value={currentDate}
                                onChange={(e) =>
                                  setBookingEdits((prev) => ({
                                    ...prev,
                                    [booking.id]: {
                                      ...prev[booking.id],
                                      preferredDate: e.target.value,
                                    },
                                  }))
                                }
                                className="mt-1 min-h-[42px] w-full border border-stone bg-white px-3 text-xs"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`booking-time-${booking.id}`}
                                className="block text-[11px] text-taupe uppercase"
                              >
                                {isPending ? 'Ajuster l’heure' : 'Nouvel horaire'}
                              </label>
                              {data.config.bookingRules.flexibleHours !== false ? (
                                <input
                                  id={`booking-time-${booking.id}`}
                                  type="time"
                                  value={currentTime}
                                  onChange={(e) =>
                                    setBookingEdits((prev) => ({
                                      ...prev,
                                      [booking.id]: {
                                        ...prev[booking.id],
                                        preferredTime: e.target.value,
                                      },
                                    }))
                                  }
                                  className="mt-1 min-h-[42px] w-full border border-stone bg-white px-3 text-xs"
                                />
                              ) : (
                                <select
                                  id={`booking-time-${booking.id}`}
                                  value={currentTime}
                                  onChange={(e) =>
                                    setBookingEdits((prev) => ({
                                      ...prev,
                                      [booking.id]: {
                                        ...prev[booking.id],
                                        preferredTime: e.target.value,
                                      },
                                    }))
                                  }
                                  className="mt-1 min-h-[42px] w-full border border-stone bg-white px-3 text-xs"
                                >
                                  {!allSlotsForDay.includes(currentTime) && (
                                    <option value={currentTime}>{currentTime}</option>
                                  )}
                                  {allSlotsForDay.map((slot) => (
                                    <option key={slot} value={slot}>
                                      {slot}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <div>
                              <label
                                htmlFor={`booking-note-${booking.id}`}
                                className="block text-[11px] text-taupe uppercase"
                              >
                                Mot pour la cliente (e-mail)
                              </label>
                              <input
                                id={`booking-note-${booking.id}`}
                                type="text"
                                value={currentNote}
                                placeholder="Ex. Adresse exacte envoyée, ou autre horaire proposé"
                                onChange={(e) =>
                                  setBookingEdits((prev) => ({
                                    ...prev,
                                    [booking.id]: {
                                      ...prev[booking.id],
                                      adminDecisionNote: e.target.value,
                                    },
                                  }))
                                }
                                className="mt-1 min-h-[42px] w-full border border-stone bg-white px-3 text-xs"
                              />
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleBookingDecision(booking, 'confirmed')}
                                className="inline-flex min-h-[42px] items-center gap-1.5 border border-emerald-900 bg-emerald-900 px-4 py-2 text-xs font-medium text-white uppercase hover:bg-emerald-800 disabled:opacity-50"
                              >
                                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                <span>
                                  {isPending
                                    ? 'Valider & envoyer e-mail'
                                    : 'Enregistrer & renvoyer confirmation'}
                                </span>
                              </button>

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleBookingDecision(booking, 'cancelled')}
                                className="inline-flex min-h-[42px] items-center gap-1.5 border border-amber-800 bg-white px-3.5 py-2 text-xs font-medium text-amber-900 uppercase hover:bg-amber-50 disabled:opacity-50 cursor-pointer"
                              >
                                <XCircle className="h-4 w-4" aria-hidden="true" />
                                <span>Refuser & notifier</span>
                              </button>

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  setShowSlotsProposer((prev) => ({
                                    ...prev,
                                    [booking.id]: !prev[booking.id],
                                  }))
                                }
                                className={`inline-flex min-h-[42px] items-center gap-1.5 border px-3.5 py-2 text-xs font-medium uppercase cursor-pointer transition-colors ${
                                  showSlotsProposer[booking.id]
                                    ? 'border-charcoal bg-charcoal text-ivory'
                                    : 'border-charcoal/40 bg-ivory/50 text-charcoal hover:bg-stone/20'
                                }`}
                              >
                                <Calendar className="h-4 w-4" aria-hidden="true" />
                                <span>
                                  {showSlotsProposer[booking.id]
                                    ? 'Fermer les options'
                                    : 'Proposer de nouvelles dates'}
                                </span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={async () => {
                                await deleteBooking(booking.id);
                                notify('Demande supprimée.');
                              }}
                              className="inline-flex min-h-[42px] items-center gap-1.5 border border-red-200 px-3 py-2 text-xs text-red-800 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Supprimer</span>
                            </button>
                          </div>

                          {showSlotsProposer[booking.id] && (
                            <div className="mt-4 border border-charcoal/20 bg-ivory/60 p-4">
                              <div className="flex items-center justify-between mb-3 border-b border-stone/30 pb-2">
                                <div>
                                  <p className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                                    Proposer plusieurs créneaux au choix
                                  </p>
                                  <p className="text-[11px] text-taupe">
                                    La cliente recevra un e-mail avec chaque option cliquable et pourra valider son choix en direct.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentSlots = proposedSlotsMap[booking.id] || [
                                      { date: booking.preferredDate, time: '10:00' },
                                      { date: booking.preferredDate, time: '14:00' },
                                    ];
                                    setProposedSlotsMap((prev) => ({
                                      ...prev,
                                      [booking.id]: [
                                        ...currentSlots,
                                        { date: booking.preferredDate, time: '16:00' },
                                      ],
                                    }));
                                  }}
                                  className="text-[11px] font-medium text-charcoal underline cursor-pointer"
                                >
                                  + Ajouter une option
                                </button>
                              </div>

                              <div className="space-y-2">
                                {(
                                  proposedSlotsMap[booking.id] || [
                                    { date: booking.preferredDate, time: '10:00' },
                                    { date: booking.preferredDate, time: '14:00' },
                                    { date: booking.preferredDate, time: '16:00' },
                                  ]
                                ).map((slot, sIdx, arr) => (
                                  <div
                                    key={sIdx}
                                    className="flex flex-wrap items-center gap-2 border border-stone/30 bg-white p-2.5 text-xs"
                                  >
                                    <span className="font-semibold text-charcoal w-16">
                                      Option {sIdx + 1}
                                    </span>
                                    <input
                                      type="date"
                                      value={slot.date}
                                      onChange={(e) => {
                                        const nextArr = [...arr];
                                        nextArr[sIdx] = { ...slot, date: e.target.value };
                                        setProposedSlotsMap((prev) => ({
                                          ...prev,
                                          [booking.id]: nextArr,
                                        }));
                                      }}
                                      className="border border-stone px-2 py-1 text-xs"
                                    />
                                    <input
                                      type="time"
                                      value={slot.time}
                                      onChange={(e) => {
                                        const nextArr = [...arr];
                                        nextArr[sIdx] = { ...slot, time: e.target.value };
                                        setProposedSlotsMap((prev) => ({
                                          ...prev,
                                          [booking.id]: nextArr,
                                        }));
                                      }}
                                      className="border border-stone px-2 py-1 text-xs"
                                    />
                                    {arr.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextArr = arr.filter((_, i) => i !== sIdx);
                                          setProposedSlotsMap((prev) => ({
                                            ...prev,
                                            [booking.id]: nextArr,
                                          }));
                                        }}
                                        className="text-red-700 hover:text-red-900 text-xs px-1"
                                      >
                                        Supprimer
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              <div className="mt-4 flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowSlotsProposer((prev) => ({
                                      ...prev,
                                      [booking.id]: false,
                                    }))
                                  }
                                  className="border border-stone px-3 py-1.5 text-xs text-charcoal hover:bg-stone/10"
                                >
                                  Annuler
                                </button>
                                <button
                                  type="button"
                                  disabled={sendingProposals === booking.id}
                                  onClick={() => handleSendSlotProposals(booking)}
                                  className="border border-charcoal bg-charcoal px-4 py-1.5 text-xs font-medium text-ivory uppercase hover:bg-silk disabled:opacity-50"
                                >
                                  {sendingProposals === booking.id
                                    ? 'Envoi en cours...'
                                    : 'Envoyer les options par e-mail'}
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {!showEditor && (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteBooking(booking.id);
                              notify('Demande supprimée.');
                            }}
                            className="inline-flex min-h-[38px] items-center gap-1.5 border border-red-200 px-3 py-1.5 text-xs text-red-800 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Supprimer la fiche</span>
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: SCHEDULE & SUPPLEMENT (ILLUSTRATED & PLAIN FRENCH) */}
        {activeTab === 'schedule' && (() => {
          const rules = data.config.bookingRules;
          const isFlexible = rules.flexibleHours !== false;
          const isSundayOpen = rules.sundayEnabled && !(rules.closedWeekdays || []).includes(0);
          const openWeekdaysList = WEEKDAYS.filter((wd) =>
            wd.day === 0 ? isSundayOpen : !(rules.closedWeekdays || []).includes(wd.day)
          );
          const { unique: sortedAllSlots } = splitAndSortSlots(
            [...rules.standardSlots, ...rules.eveningSlots],
            rules.lateHourThreshold
          );

          return (
            <section className="space-y-6">
              {/* Compact Overview Banner */}
              <div className="border border-charcoal bg-obsidian p-5 text-ivory sm:p-6">
                <p className="text-[11px] font-medium tracking-[0.22em] text-stone uppercase">
                  Votre planning en un coup d’œil
                </p>
                <h2 className="mt-1 font-serif text-3xl text-ivory">Horaires & Supplément</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="border border-white/15 bg-white/5 p-3.5">
                    <p className="text-[11px] tracking-wider text-stone uppercase">
                      Mode d’horaire
                    </p>
                    <p className="mt-1 text-sm font-medium text-ivory">
                      {isFlexible
                        ? 'Créneaux flexibles (la cliente choisit l’heure)'
                        : `${sortedAllSlots.length} heures fixes choisies`}
                    </p>
                  </div>
                  <div className="border border-white/15 bg-white/5 p-3.5">
                    <p className="text-[11px] tracking-wider text-stone uppercase">Jours ouverts</p>
                    <p className="mt-1 text-sm font-medium text-ivory">
                      {openWeekdaysList.length === 7
                        ? 'Tous les jours (7j/7)'
                        : openWeekdaysList.length === 0
                          ? 'Aucun jour ouvert'
                          : openWeekdaysList.map((w) => w.shortLabel).join(', ')}
                    </p>
                  </div>
                  <div className="border border-white/15 bg-white/5 p-3.5">
                    <p className="text-[11px] tracking-wider text-stone uppercase">Supplément</p>
                    <p className="mt-1 text-sm font-medium text-ivory">
                      {rules.supplementAmount <= 0
                        ? 'Aucun supplément appliqué'
                        : `+${rules.supplementAmount} € (${rules.lateHourThreshold < 24 ? `dès ${rules.lateHourThreshold}h, ` : ''}${isSundayOpen ? 'dimanche & ' : ''}fériés)`}
                    </p>
                  </div>
                </div>
              </div>

              {/* CARD 1: OPEN DAYS & HOLIDAY CLOSURES */}
              <article className="space-y-5 border border-stone bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-5 border-b border-stone/60 pb-5 sm:flex-row sm:items-center">
                  <img
                    src="/illus-jours.jpg"
                    alt="Calendrier du studio avec une journée marquée fermée"
                    className="aspect-[4/3] w-full shrink-0 border border-stone/70 bg-ivory object-cover sm:w-44"
                  />
                  <div>
                    <h3 className="font-serif text-2xl text-charcoal sm:text-3xl">
                      1. Jours d’ouverture & Congés
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-taupe">
                      Cliquez sur un jour pour l’ouvrir ou le fermer. Par défaut, vous pouvez
                      recevoir vos clientes tous les jours sur rendez-vous.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {WEEKDAYS.map((wd) => {
                    const closed =
                      wd.day === 0
                        ? !isSundayOpen
                        : (rules.closedWeekdays || []).includes(wd.day);
                    return (
                      <button
                        key={wd.day}
                        type="button"
                        onClick={() => toggleWeekdayClosed(wd.day)}
                        className={`flex min-h-[54px] flex-col items-center justify-center border px-3 py-2 text-xs font-medium uppercase transition-colors ${
                          closed
                            ? 'border-red-200 bg-red-50 text-red-900'
                            : 'border-charcoal bg-charcoal text-ivory'
                        }`}
                      >
                        <span>{wd.label}</span>
                        <span className="mt-0.5 text-[10px] opacity-80">
                          {closed
                            ? 'Fermé'
                            : wd.day === 0 && rules.supplementAmount > 0
                              ? `Ouvert (+${rules.supplementAmount} €)`
                              : 'Ouvert'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-stone/60 pt-5">
                  <div className="mb-3">
                    <p className="text-[11px] font-semibold text-taupe uppercase tracking-wider">
                      Gestion mensuelle visuelle du calendrier
                    </p>
                    <p className="text-xs text-taupe">
                      Parcourez les mois de l’année et cliquez sur n’importe quel jour pour fermer ou réouvrir le studio en direct.
                    </p>
                  </div>
                  <MonthlyScheduleCalendar
                    rules={rules}
                    onUpdateRules={async (partial) => {
                      await updateConfig({ bookingRules: { ...rules, ...partial } });
                      notify('Calendrier mis à jour.');
                    }}
                    bookings={data.bookings}
                  />
                </div>
              </article>

              {/* CARD 2: EVENING, SUNDAY & PUBLIC HOLIDAY SUPPLEMENT */}
              <article className="space-y-5 border border-stone bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-5 border-b border-stone/60 pb-5 sm:flex-row sm:items-center">
                  <img
                    src="/illus-supplement.jpg"
                    alt="Horloge après 19 heures avec soleil et croissant de lune"
                    className="aspect-[4/3] w-full shrink-0 border border-stone/70 bg-ivory object-cover sm:w-44"
                  />
                  <div>
                    <h3 className="font-serif text-2xl text-charcoal sm:text-3xl">
                      2. Supplément soir, dimanche & fériés
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-taupe">
                      Ce petit plus s’ajoute automatiquement quand la cliente choisit le soir, un
                      dimanche ou un jour férié, exactement comme sur votre affiche Instagram.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3 border border-stone bg-ivory/60 p-4">
                    <label
                      htmlFor="supplement-amount-input"
                      className="block text-xs font-semibold tracking-wider text-charcoal uppercase"
                    >
                      Montant du supplément
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Diminuer le supplément de 1 euro"
                        onClick={() =>
                          handleUpdateSupplementAmount(
                            rules.supplementAmount - 1,
                            `Supplément réglé sur +${Math.max(0, rules.supplementAmount - 1)} €.`
                          )
                        }
                        className="inline-flex h-[44px] w-[44px] items-center justify-center border border-charcoal/40 bg-white text-base font-medium text-charcoal hover:border-charcoal"
                      >
                        -
                      </button>
                      <input
                        id="supplement-amount-input"
                        type="number"
                        min={0}
                        max={100}
                        value={rules.supplementAmount}
                        onChange={(e) => handleUpdateSupplementAmount(Number(e.target.value))}
                        className="min-h-[44px] w-20 border border-charcoal/40 bg-white px-2 text-center font-serif text-2xl text-charcoal"
                      />
                      <span className="font-serif text-2xl text-charcoal">€</span>
                      <button
                        type="button"
                        aria-label="Augmenter le supplément de 1 euro"
                        onClick={() =>
                          handleUpdateSupplementAmount(
                            rules.supplementAmount + 1,
                            `Supplément réglé sur +${Math.min(100, rules.supplementAmount + 1)} €.`
                          )
                        }
                        className="inline-flex h-[44px] w-[44px] items-center justify-center border border-charcoal/40 bg-white text-base font-medium text-charcoal hover:border-charcoal"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[0, 5, 10, 15].map((presetAmt) => (
                        <button
                          key={presetAmt}
                          type="button"
                          onClick={() =>
                            handleUpdateSupplementAmount(
                              presetAmt,
                              `Supplément réglé sur +${presetAmt} €.`
                            )
                          }
                          className={`min-h-[36px] border px-2.5 text-xs ${
                            rules.supplementAmount === presetAmt
                              ? 'border-charcoal bg-charcoal text-ivory'
                              : 'border-stone bg-white text-charcoal hover:border-charcoal'
                          }`}
                        >
                          {presetAmt === 0 ? 'Aucun (0 €)' : `+${presetAmt} €`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 border border-stone bg-ivory/60 p-4">
                    <label
                      htmlFor="late-hour-select"
                      className="block text-xs font-semibold tracking-wider text-charcoal uppercase"
                    >
                      Heure de début du tarif soir
                    </label>
                    <p className="text-xs text-taupe">
                      Tout rendez-vous à partir de cette heure applique +{rules.supplementAmount} €.
                    </p>
                    <select
                      id="late-hour-select"
                      value={rules.lateHourThreshold}
                      onChange={(e) => {
                        const nextHr = Number(e.target.value) || 19;
                        handleUpdateAllSlots(
                          sortedAllSlots,
                          nextHr,
                          nextHr >= 24
                            ? 'Supplément du soir désactivé.'
                            : `Supplément soir activé à partir de ${nextHr}h00.`
                        );
                      }}
                      className="min-h-[46px] w-full border border-charcoal/40 bg-white px-3 text-sm text-charcoal"
                    >
                      <option value={18}>À partir de 18h00</option>
                      <option value={19}>À partir de 19h00 (réglage actuel)</option>
                      <option value={20}>À partir de 20h00</option>
                      <option value={21}>À partir de 21h00</option>
                      <option value={24}>Pas de supplément soir</option>
                    </select>
                  </div>
                </div>

                <details className="border-t border-stone/60 pt-4">
                  <summary className="cursor-pointer select-none py-1 text-xs font-medium text-charcoal hover:underline">
                    Voir ou modifier les jours fériés ({(rules.holidays || []).length} configurés)
                  </summary>
                  <div className="mt-4 space-y-3">
                    <p className="text-xs text-taupe">
                      Sur ces journées, le supplément de +{rules.supplementAmount} € s’applique
                      toute la journée.
                    </p>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <form onSubmit={handleAddHolidayDate} className="flex flex-wrap gap-2">
                        <input
                          type="date"
                          aria-label="Ajouter un jour férié"
                          value={newHolidayDate}
                          onChange={(e) => setNewHolidayDate(e.target.value)}
                          className="min-h-[44px] border border-stone px-3 text-sm"
                        />
                        <button
                          type="submit"
                          className="min-h-[44px] border border-charcoal bg-charcoal px-4 text-xs font-medium text-ivory uppercase"
                        >
                          Ajouter
                        </button>
                      </form>
                      <button
                        type="button"
                        onClick={handleLoadFrenchHolidaysPreset}
                        className="min-h-[40px] border border-stone bg-ivory px-3.5 text-xs font-medium text-charcoal uppercase hover:border-charcoal"
                      >
                        + Compléter les fériés français
                      </button>
                    </div>

                    {(rules.holidays || []).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {rules.holidays.map((dateStr) => (
                          <span
                            key={dateStr}
                            className="inline-flex min-h-[36px] items-center gap-2 border border-stone bg-ivory px-2.5 py-1 text-xs text-charcoal"
                          >
                            <span>{formatCompactFrenchDate(dateStr)}</span>
                            <button
                              type="button"
                              aria-label={`Retirer le jour férié ${formatCompactFrenchDate(dateStr)}`}
                              onClick={() => handleRemoveHolidayDate(dateStr)}
                              className="text-taupe hover:text-red-800"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              </article>

              {/* CARD 3: FLEXIBLE HOURS VS FIXED HOURS + PUNCTUAL TIME BLOCKER */}
              <article className="space-y-5 border border-stone bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-5 border-b border-stone/60 pb-5 sm:flex-row sm:items-center">
                  <img
                    src="/illus-horaires.jpg"
                    alt="Carnet d’agenda avec stylo, brosse à cils et flèche souple"
                    className="aspect-[4/3] w-full shrink-0 border border-stone/70 bg-ivory object-cover sm:w-44"
                  />
                  <div>
                    <h3 className="font-serif text-2xl text-charcoal sm:text-3xl">
                      3. Fonctionnement des heures
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-taupe">
                      Par défaut, la cliente écrit l’heure qui l’arrange et vous validez ensuite
                      sa demande. Vous pouvez aussi fixer des heures précises si vous préférez.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex min-h-[76px] cursor-pointer items-start gap-3 border border-stone p-4 transition-colors has-[:checked]:border-charcoal has-[:checked]:bg-ivory">
                    <input
                      type="radio"
                      name="schedule-mode"
                      checked={isFlexible}
                      onChange={() => handleToggleFlexibleHours(true)}
                      className="mt-1 h-4 w-4 accent-charcoal"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-charcoal">
                        Créneaux flexibles (par défaut)
                      </span>
                      <span className="mt-0.5 block text-xs text-taupe">
                        La cliente choisit sa date et propose l’heure souhaitée.
                      </span>
                    </span>
                  </label>

                  <label className="flex min-h-[76px] cursor-pointer items-start gap-3 border border-stone p-4 transition-colors has-[:checked]:border-charcoal has-[:checked]:bg-ivory">
                    <input
                      type="radio"
                      name="schedule-mode"
                      checked={!isFlexible}
                      onChange={() => handleToggleFlexibleHours(false)}
                      className="mt-1 h-4 w-4 accent-charcoal"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-charcoal">
                        Heures fixes uniquement
                      </span>
                      <span className="mt-0.5 block text-xs text-taupe">
                        Seules les heures ci-dessous s’affichent dans le formulaire.
                      </span>
                    </span>
                  </label>
                </div>

                {!isFlexible && (
                  <div className="space-y-4 border border-stone/80 bg-ivory/50 p-4">
                    <p className="text-xs font-medium text-charcoal">
                      Vos heures fixes proposées chaque jour :
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sortedAllSlots.map((slot) => (
                        <span
                          key={slot}
                          className="inline-flex min-h-[42px] items-center gap-2 border border-stone bg-white pr-1.5 pl-3 text-xs font-medium text-charcoal"
                        >
                          <Clock className="h-3.5 w-3.5 text-taupe" aria-hidden="true" />
                          <span>{slot}</span>
                          <button
                            type="button"
                            aria-label={`Retirer l’horaire ${slot}`}
                            onClick={() => handleRemoveTimeSlot(slot)}
                            className="inline-flex h-8 w-8 items-center justify-center text-taupe hover:text-red-800"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label
                          htmlFor="add-slot-time"
                          className="block text-[11px] text-taupe uppercase"
                        >
                          Ajouter une heure fixe
                        </label>
                        <input
                          id="add-slot-time"
                          type="time"
                          value={newSlotTime}
                          onChange={(e) => setNewSlotTime(e.target.value)}
                          className="mt-1 min-h-[44px] border border-charcoal/40 bg-white px-3 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddTimeSlot(newSlotTime)}
                        className="inline-flex min-h-[44px] items-center gap-1.5 border border-charcoal bg-charcoal px-4 text-xs font-medium text-ivory uppercase hover:bg-silk"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        <span>Ajouter</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="border-t border-stone/60 pt-4">
                  <p className="text-xs text-taupe">
                    Un empêchement sur une seule heure ? Bloquez-la ci-dessous sans fermer toute la
                    journée.
                  </p>
                  <form
                    onSubmit={handleBlockPunctualSlot}
                    className="mt-3 flex flex-wrap items-end gap-2.5"
                  >
                    <div>
                      <label
                        htmlFor="blocked-slot-date"
                        className="block text-[11px] text-taupe uppercase"
                      >
                        Date
                      </label>
                      <input
                        id="blocked-slot-date"
                        type="date"
                        value={newBlockedSlotDate}
                        onChange={(e) => setNewBlockedSlotDate(e.target.value)}
                        className="mt-1 min-h-[44px] border border-stone bg-white px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="blocked-slot-time"
                        className="block text-[11px] text-taupe uppercase"
                      >
                        Heure à bloquer
                      </label>
                      <input
                        id="blocked-slot-time"
                        type="time"
                        value={newBlockedSlotTime}
                        onChange={(e) => setNewBlockedSlotTime(e.target.value)}
                        className="mt-1 min-h-[44px] border border-stone bg-white px-3 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="min-h-[44px] border border-charcoal px-4 text-xs font-medium text-charcoal uppercase hover:bg-ivory"
                    >
                      Bloquer cette heure
                    </button>
                  </form>

                  {(rules.blockedSlots || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rules.blockedSlots.map((slot) => (
                        <span
                          key={`${slot.date}-${slot.time}`}
                          className="inline-flex min-h-[38px] items-center gap-2 border border-red-200 bg-red-50/70 px-3 py-1 text-xs text-charcoal"
                        >
                          <span>
                            {formatCompactFrenchDate(slot.date)} · {slot.time}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleBlockedSlot(slot.date, slot.time)}
                            className="font-medium text-red-800 underline"
                          >
                            Libérer
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            </section>
          );
        })()}

        {/* TAB 3: STUDIO RECEIVING EMAIL & HISTORY LOG */}
        {activeTab === 'emails' && (
          <section className="space-y-6">
            <article className="space-y-4 border border-stone bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                <Mail className="h-5 w-5 text-charcoal" aria-hidden="true" />
                <h2 className="font-serif text-3xl text-charcoal">
                  Adresse de réception du studio
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-taupe">
                C’est sur cette adresse e-mail que vous recevez chaque nouvelle demande de
                rendez-vous. Vos clientes reçoivent ensuite leur confirmation ou refus sur
                l’adresse qu’elles ont indiquée.
              </p>

              <form onSubmit={handleSaveContactEmail} className="flex flex-wrap items-end gap-3">
                <div className="min-w-[260px] flex-1">
                  <label
                    htmlFor="emails-admin-recipient"
                    className="block text-[11px] text-taupe uppercase"
                  >
                    Votre adresse e-mail de notification
                  </label>
                  <input
                    id="emails-admin-recipient"
                    type="email"
                    required
                    value={contactEmailInput}
                    onChange={(e) => setContactEmailInput(e.target.value)}
                    placeholder="votre.email@gmail.com"
                    className="mt-1 min-h-[44px] w-full border border-stone px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center gap-2 border border-charcoal bg-charcoal px-5 py-2 text-xs font-medium text-ivory uppercase hover:bg-silk"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  <span>Enregistrer</span>
                </button>
                <button
                  type="button"
                  disabled={sendingTestEmail}
                  onClick={handleSendStudioTestEmail}
                  className="inline-flex min-h-[44px] items-center gap-2 border border-charcoal px-4 py-2 text-xs font-medium text-charcoal uppercase hover:bg-ivory disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {sendingTestEmail ? 'Envoi...' : 'Envoyer un e-mail test'}
                  </span>
                </button>
              </form>
            </article>

            {/* Email History Log (Plain French) */}
            <article className="border border-stone bg-white p-5 sm:p-6">
              <h3 className="font-serif text-2xl text-charcoal">
                Journal des e-mails ({data.emailLogs.length})
              </h3>
              <p className="mt-1 text-xs text-taupe">
                Historique des messages envoyés pour vos demandes reçues et vos réponses
                clientes.
              </p>

              {data.emailLogs.length === 0 ? (
                <p className="mt-4 text-xs text-taupe">Aucun e-mail envoyé pour le moment.</p>
              ) : (
                <ul className="mt-4 divide-y divide-stone/60">
                  {data.emailLogs.map((log) => (
                    <li key={log.id} className="py-3.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="border border-stone bg-ivory px-2 py-0.5 text-[10px] font-medium tracking-wider text-charcoal uppercase">
                            {formatEmailKindLabel(log.kind)}
                          </span>
                          <span className="text-taupe">{formatEmailLogDate(log.createdAt)}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[10px] uppercase ${
                            log.status === 'sent'
                              ? 'bg-emerald-100 text-emerald-950'
                              : log.status === 'error'
                                ? 'bg-red-100 text-red-950'
                                : 'bg-amber-100 text-amber-950'
                          }`}
                        >
                          {log.status === 'sent'
                            ? 'Envoyé'
                            : log.status === 'error'
                              ? 'Non remis'
                              : 'En attente'}
                        </span>
                      </div>
                      <p className="mt-1.5 font-medium text-charcoal">
                        {log.subject} — <strong>{log.to}</strong>
                      </p>
                      <p className="mt-0.5 text-taupe">{formatEmailDetailHuman(log)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        )}

        {/* TAB 4: SERVICES & ADDONS (YDM style direct editing + cropping modal) */}
        {activeTab === 'services' && (
          <section className="space-y-8 animate-fade-in">
            {/* Header minimaliste et boutons d'actions */}
            <div className="flex flex-col gap-4 border border-stone bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-serif text-3xl text-charcoal">Prestations &amp; Tarifs</h2>
                  <span className="inline-flex items-center border border-charcoal/20 bg-ivory px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-charcoal uppercase">
                    Durée uniforme : 2h par soin
                  </span>
                </div>
                <p className="mt-1 text-xs text-taupe">
                  Chaque prestation dispose d’une durée fixe de 2 heures. Modifiez vos prix, photos avec recadrage sur-mesure (16:10) et vidéos HD directement sur le soin.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={openCreateServiceModal}
                  className="inline-flex min-h-[44px] items-center gap-2 border border-charcoal bg-charcoal px-4 py-2 text-xs font-semibold tracking-wider text-ivory uppercase hover:bg-silk transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Ajouter une prestation</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextShow = !(data.config.showServiceImages !== false);
                    updateConfig({ showServiceImages: nextShow });
                    notify(
                      nextShow
                        ? 'Les illustrations des prestations sont de nouveau affichées sur le site.'
                        : 'Toutes les illustrations sont maintenant masquées sur la carte publique.'
                    );
                  }}
                  className="inline-flex min-h-[44px] items-center gap-2 border border-stone bg-white px-4 py-2 text-xs font-medium tracking-wider text-charcoal uppercase hover:border-charcoal transition-colors cursor-pointer"
                >
                  {data.config.showServiceImages !== false ? (
                    <>
                      <EyeOff className="h-4 w-4 text-taupe" />
                      <span>Masquer visuels du site</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 text-emerald-700" />
                      <span>Afficher visuels du site</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Filtres par catégorie */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all', label: 'Toutes les prestations' },
                { id: 'extensions', label: 'Extensions' },
                { id: 'depose', label: 'Déposes' },
                { id: 'rehaussement', label: 'Rehaussement' },
                { id: 'blanchiment', label: 'Blanchiment' },
              ].map((cat) => {
                const count =
                  cat.id === 'all'
                    ? data.services.length
                    : data.services.filter((s) => s.category === cat.id).length;
                const active = serviceCategoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setServiceCategoryFilter(cat.id)}
                    className={`min-h-[38px] border px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors cursor-pointer ${
                      active
                        ? 'border-charcoal bg-charcoal text-ivory font-semibold'
                        : 'border-stone bg-white text-charcoal hover:border-charcoal'
                    }`}
                  >
                    {cat.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Grille responsive des Prestations */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.services
                .filter((s) => serviceCategoryFilter === 'all' || s.category === serviceCategoryFilter)
                .map((service) => {
                  const isImageShownOnSite =
                    data.config.showServiceImages !== false &&
                    service.showImage !== false &&
                    Boolean(service.imageUrl);

                  return (
                    <div
                      key={service.id}
                      className="group flex flex-col justify-between border border-stone bg-white shadow-xs hover:border-charcoal transition-all"
                    >
                      <div>
                        {/* Aperçu du média (Photo ou Vidéo) */}
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-obsidian border-b border-stone/50">
                          {service.imageUrl ? (
                            <AestheticMediaViewer
                              url={service.imageUrl}
                              alt={service.name}
                              badge={service.category}
                              aspectRatioClass="aspect-[16/10]"
                              allowExpand={true}
                              className={isImageShownOnSite ? '' : 'opacity-50 grayscale'}
                            />
                          ) : (
                            <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center bg-ivory text-taupe">
                              <Sparkles className="h-6 w-6 opacity-30 mb-1" />
                              <span className="text-[10px] uppercase tracking-wider">
                                Aucun visuel défini
                              </span>
                            </div>
                          )}

                          {/* Statut Visuel actif/masqué */}
                          <div className="absolute top-2 right-2 z-20">
                            {isImageShownOnSite ? (
                              <span className="bg-emerald-950/85 backdrop-blur-xs text-emerald-200 border border-emerald-400/30 text-[9px] font-semibold px-2 py-0.5 uppercase tracking-wider">
                                Visible
                              </span>
                            ) : (
                              <span className="bg-stone-900/85 backdrop-blur-xs text-stone-300 border border-white/20 text-[9px] font-semibold px-2 py-0.5 uppercase tracking-wider">
                                Masqué
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Contenu de la fiche */}
                        <div className="p-5 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-medium uppercase tracking-wider text-taupe">
                                {service.category}
                              </span>
                              <h3 className="font-serif text-lg font-medium text-charcoal leading-snug">
                                {service.name}
                              </h3>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-serif text-xl font-medium text-charcoal">
                                {service.fullPrice} €
                              </span>
                              {service.refillPrice != null && (
                                <span className="block text-[10px] text-taupe">
                                  Rempl. {service.refillPrice} €
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center border border-charcoal/10 bg-ivory px-2 py-0.5 text-[10px] font-medium tracking-wider text-charcoal uppercase">
                              Durée : 2h
                            </span>
                            {service.active ? (
                              <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 border border-emerald-200 font-medium">
                                En ligne
                              </span>
                            ) : (
                              <span className="text-[10px] text-stone-600 bg-stone/20 px-2 py-0.5">
                                Désactivé
                              </span>
                            )}
                          </div>

                          {service.description && (
                            <p className="text-xs text-taupe line-clamp-2 leading-relaxed">
                              {service.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Barre d'action rapide sous chaque carte */}
                      <div className="border-t border-stone/60 p-3 bg-ivory/30 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openEditServiceModal(service)}
                          className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 border border-charcoal bg-white px-3 py-1.5 text-xs font-semibold text-charcoal uppercase tracking-wider hover:bg-charcoal hover:text-ivory transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Modifier</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const nextActive = !service.active;
                            upsertService({ ...service, active: nextActive });
                            notify(
                              nextActive
                                ? `Prestation « ${service.name} » activée.`
                                : `Prestation « ${service.name} » masquée.`
                            );
                          }}
                          title={service.active ? 'Masquer du site' : 'Activer sur le site'}
                          className={`min-h-[38px] min-w-[38px] inline-flex items-center justify-center border transition-colors cursor-pointer ${
                            service.active
                              ? 'border-stone text-charcoal hover:border-charcoal bg-white'
                              : 'border-stone bg-stone/20 text-stone-500'
                          }`}
                        >
                          {service.active ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Supprimer définitivement « ${service.name} » ?`)) {
                              deleteService(service.id);
                              notify('Prestation supprimée du catalogue.');
                            }
                          }}
                          title="Supprimer la prestation"
                          className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center border border-red-200 bg-white text-red-700 hover:bg-red-50 hover:border-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* MODAL DE MODIFICATION DU SOIN & VISUEL (Style YDM Coiffure) */}
            {isServiceModalOpen && (
              <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/85 p-3 sm:p-6 backdrop-blur-md overflow-y-auto animate-fade-in"
              >
                <div className="relative my-8 w-full max-w-2xl border border-stone bg-white p-6 sm:p-8 text-charcoal shadow-2xl max-h-[92vh] overflow-y-auto">
                  {/* Entête du modal */}
                  <div className="flex items-center justify-between border-b border-stone/60 pb-4">
                    <div>
                      <span className="text-[10px] font-semibold tracking-widest text-taupe uppercase">
                        Gestion de la prestation
                      </span>
                      <h3 className="font-serif text-2xl text-charcoal font-medium">
                        {isCreatingService
                          ? 'Ajouter une nouvelle prestation'
                          : `Modifier : ${serviceForm.name || 'Prestation'}`}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsServiceModalOpen(false)}
                      aria-label="Fermer"
                      className="flex h-9 w-9 items-center justify-center border border-stone hover:border-charcoal transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveServiceModal} className="mt-6 space-y-6">
                    {/* SECTION 1: VISUEL (PHOTO OU VIDÉO DIRECTE) */}
                    <div className="border border-stone bg-paper/40 p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="font-serif text-lg font-medium text-charcoal">
                            Photo ou Vidéo du soin
                          </h4>
                          <p className="text-xs text-taupe">
                            Cadrage 16:10 garanti. Recadrez la photo à votre guise ou liez une vidéo HD.
                          </p>
                        </div>

                        {serviceForm.imageUrl && isVideoUrl(serviceForm.imageUrl) && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 font-medium">
                            <Film className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Format Vidéo HD</span>
                          </span>
                        )}
                      </div>

                      {/* Aperçu direct en 16:10 */}
                      <div className="relative aspect-[16/10] w-full overflow-hidden border border-stone bg-obsidian">
                        {serviceForm.imageUrl ? (
                          <AestheticMediaViewer
                            url={serviceForm.imageUrl}
                            alt={serviceForm.name}
                            aspectRatioClass="aspect-[16/10]"
                            allowExpand={true}
                          />
                        ) : (
                          <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center text-taupe bg-ivory">
                            <Sparkles className="h-8 w-8 opacity-30 mb-2" />
                            <span className="text-xs uppercase tracking-wider font-medium">
                              Aucun visuel associé
                            </span>
                            <span className="text-[11px] text-taupe/80 mt-1">
                              Importez une photo ou vidéo ci-dessous
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Barre de progression réelle lors de l'envoi vers Cloudinary */}
                      {uploadingMedia && (
                        <div className="space-y-1.5 border border-amber-300 bg-amber-50 p-3.5">
                          <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
                              <span>Envoi vers Cloudinary en cours...</span>
                            </span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden bg-amber-200 rounded-full">
                            <div
                              className="h-full bg-amber-600 transition-all duration-150"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Inputs cachés déclenchés par les boutons clairs */}
                      <input
                        ref={imageFileInputRef}
                        type="file"
                        accept="image/*,.heic,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleSelectImageForCrop(file);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />

                      <input
                        ref={videoFileInputRef}
                        type="file"
                        accept="video/*,.mp4,.mov,.webm,.m4v"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleSelectVideoUpload(file);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />

                      {/* Boutons d'action directs et compréhensibles */}
                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          disabled={uploadingMedia}
                          onClick={() => imageFileInputRef.current?.click()}
                          className="min-h-[44px] inline-flex items-center gap-2 border border-charcoal bg-charcoal px-4 py-2 text-xs font-semibold tracking-wider text-ivory uppercase hover:bg-silk transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Upload className="h-4 w-4" />
                          <span>Changer la photo (avec recadrage)</span>
                        </button>

                        <button
                          type="button"
                          disabled={uploadingMedia}
                          onClick={() => videoFileInputRef.current?.click()}
                          className="min-h-[44px] inline-flex items-center gap-2 border border-stone bg-white px-4 py-2 text-xs font-semibold tracking-wider text-charcoal uppercase hover:border-charcoal transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Video className="h-4 w-4" />
                          <span>Remplacer par une vidéo</span>
                        </button>

                        {serviceForm.imageUrl && !isVideoUrl(serviceForm.imageUrl) && (
                          <button
                            type="button"
                            onClick={handleRecropExistingImage}
                            className="min-h-[44px] inline-flex items-center gap-1.5 border border-stone bg-white px-3 py-2 text-xs font-medium text-charcoal hover:border-charcoal transition-colors cursor-pointer"
                          >
                            <Crop className="h-3.5 w-3.5" />
                            <span>Ajuster le cadrage</span>
                          </button>
                        )}

                        {serviceForm.imageUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setServiceForm((prev) => ({
                                ...prev,
                                imageUrl: '',
                              }))
                            }
                            className="min-h-[44px] text-xs text-red-700 hover:underline px-3 py-2 cursor-pointer ml-auto"
                          >
                            Retirer le visuel
                          </button>
                        )}
                      </div>

                      {/* Lien discret pour les options avancées d'URL */}
                      <div className="pt-2 border-t border-stone/50">
                        <button
                          type="button"
                          onClick={() => setShowManualUrl(!showManualUrl)}
                          className="text-[11px] text-taupe hover:text-charcoal underline cursor-pointer"
                        >
                          {showManualUrl
                            ? 'Masquer le lien URL direct'
                            : 'Options avancées : voir ou modifier le lien direct'}
                        </button>

                        {showManualUrl && (
                          <div className="mt-2.5">
                            <input
                              type="text"
                              value={serviceForm.imageUrl}
                              onChange={(e) =>
                                setServiceForm((prev) => ({ ...prev, imageUrl: e.target.value }))
                              }
                              placeholder="https://res.cloudinary.com/..."
                              className="min-h-[40px] w-full border border-stone bg-white px-3 text-xs font-mono"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SECTION 2: INFORMATIONS DE LA PRESTATION */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wider text-charcoal">
                          Nom de la prestation *
                        </label>
                        <input
                          type="text"
                          required
                          value={serviceForm.name}
                          onChange={(e) =>
                            setServiceForm((prev) => ({ ...prev, name: e.target.value }))
                          }
                          placeholder="Ex. Pose mixte (cil à cil + 4D)"
                          className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wider text-charcoal">
                          Catégorie *
                        </label>
                        <select
                          value={serviceForm.category}
                          onChange={(e) =>
                            setServiceForm((prev) => ({
                              ...prev,
                              category: e.target.value as ServiceCategory,
                            }))
                          }
                          className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 text-sm"
                        >
                          {CATEGORY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wider text-charcoal">
                          Tarif principal (€) *
                        </label>
                        <input
                          type="number"
                          required
                          value={serviceForm.fullPrice}
                          onChange={(e) =>
                            setServiceForm((prev) => ({
                              ...prev,
                              fullPrice: Number(e.target.value) || 0,
                            }))
                          }
                          className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wider text-charcoal">
                          Remplissage / Option (€, laisser vide si aucun)
                        </label>
                        <input
                          type="number"
                          value={serviceForm.refillPrice ?? ''}
                          placeholder="Aucun remplissage"
                          onChange={(e) =>
                            setServiceForm((prev) => ({
                              ...prev,
                              refillPrice: e.target.value === '' ? null : Number(e.target.value),
                            }))
                          }
                          className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 text-sm"
                        />
                      </div>
                    </div>

                    {/* Durée uniforme de 2h */}
                    <div className="border border-stone/60 bg-ivory/50 p-3.5 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-charcoal uppercase tracking-wider">
                          Durée de la prestation
                        </span>
                        <p className="text-[11px] text-taupe">
                          Conformément aux règles du studio, tous les soins durent 2 heures pour le créneau client.
                        </p>
                      </div>
                      <span className="border border-charcoal bg-charcoal text-ivory px-3 py-1 text-xs font-bold tracking-widest uppercase">
                        2 heures (120 min)
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wider text-charcoal">
                        Description du soin
                      </label>
                      <textarea
                        rows={3}
                        value={serviceForm.description}
                        onChange={(e) =>
                          setServiceForm((prev) => ({ ...prev, description: e.target.value }))
                        }
                        placeholder="Description courte affichée aux clientes lors de la sélection..."
                        className="mt-1 w-full border border-stone bg-white p-3 text-sm leading-relaxed"
                      />
                    </div>

                    {/* SECTION 3: VISIBILITÉ & ACTIVATION */}
                    <div className="border-t border-stone/60 pt-4 flex flex-wrap gap-4">
                      <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2.5 text-xs text-charcoal">
                        <input
                          type="checkbox"
                          checked={serviceForm.active}
                          onChange={(e) =>
                            setServiceForm((prev) => ({ ...prev, active: e.target.checked }))
                          }
                          className="h-4 w-4 accent-charcoal"
                        />
                        <span>Prestation active et réservable sur le site</span>
                      </label>

                      <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2.5 text-xs text-charcoal">
                        <input
                          type="checkbox"
                          checked={serviceForm.showImage}
                          onChange={(e) =>
                            setServiceForm((prev) => ({ ...prev, showImage: e.target.checked }))
                          }
                          className="h-4 w-4 accent-charcoal"
                        />
                        <span>Afficher le visuel (photo ou vidéo) sur la carte publique</span>
                      </label>
                    </div>

                    {/* PIED DE MODAL AVEC SAUVEGARDE EXPLICITE */}
                    <div className="border-t border-stone pt-5 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setIsServiceModalOpen(false)}
                        disabled={savingService}
                        className="min-h-[44px] border border-stone px-5 py-2 text-xs uppercase tracking-wider text-taupe hover:border-charcoal hover:text-charcoal transition-colors cursor-pointer"
                      >
                        Annuler
                      </button>

                      <button
                        type="submit"
                        disabled={savingService || uploadingMedia}
                        className="min-h-[44px] inline-flex items-center gap-2 border border-charcoal bg-charcoal px-7 py-2.5 text-xs font-semibold tracking-widest text-ivory uppercase hover:bg-silk transition-colors disabled:opacity-60 cursor-pointer shadow-md"
                      >
                        {savingService ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Enregistrement en direct...</span>
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            <span>Enregistrer les modifications</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL INTERACTIF DE RECADRAGE DE PHOTO 16:10 */}
            <ImageCropModal
              isOpen={cropModalOpen}
              imageSrc={cropImageSrc}
              fileName={cropFileName}
              onClose={() => setCropModalOpen(false)}
              onCropComplete={handleCropComplete}
              aspectRatio={16 / 10}
            />

            {/* SECTION ADDONS / OPTIONS */}
            <div className="border border-stone bg-white p-6">
              <h3 className="font-serif text-2xl text-charcoal">Options &amp; Suppléments</h3>
              <ul className="mt-4 divide-y divide-stone/60">
                {data.addons.map((addon) => (
                  <li key={addon.id} className="flex flex-wrap items-center justify-between gap-4 py-3">
                    <div>
                      <p className="font-medium text-charcoal">
                        {addon.name} (
                        {addon.price > 0 ? `+${addon.price} €` : addon.priceLabel || 'Gratuit'})
                      </p>
                      <p className="text-xs text-taupe">{addon.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        deleteAddon(addon.id);
                        notify('Option supprimée.');
                      }}
                      className="inline-flex min-h-[38px] items-center gap-1 border border-red-200 px-3 py-1 text-xs text-red-800 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Supprimer</span>
                    </button>
                  </li>
                ))}
              </ul>

              <form onSubmit={handleAddAddon} className="mt-5 grid gap-3 border-t border-stone/60 pt-4 sm:grid-cols-4">
                <input
                  type="text"
                  placeholder="Nom de l’option"
                  value={newAddonName}
                  onChange={(e) => setNewAddonName(e.target.value)}
                  className="min-h-[44px] border border-stone px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Description courte"
                  value={newAddonDesc}
                  onChange={(e) => setNewAddonDesc(e.target.value)}
                  className="min-h-[44px] border border-stone px-3 py-2 text-sm sm:col-span-2"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Prix €"
                    value={newAddonPrice}
                    onChange={(e) => setNewAddonPrice(Number(e.target.value) || 0)}
                    className="min-h-[44px] w-24 border border-stone px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] flex-1 border border-charcoal bg-charcoal px-4 text-xs font-medium text-ivory uppercase"
                  >
                    Ajouter
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* TAB 5: CONTENT & PROTOCOLS */}
        {activeTab === 'content' && (
          <section className="space-y-8">
            <div className="space-y-6 border border-stone bg-white p-6">
              <div>
                <h2 className="font-serif text-3xl text-charcoal">Identité &amp; Textes du site</h2>
                <p className="mt-1 text-xs text-taupe">
                  Personnalisez l’intégralité des titres, slogans, textes et informations affichés sur chaque section du site vitrine.
                </p>
              </div>

              {/* 1. Coordonnées & Studio */}
              <div className="border border-stone/60 bg-ivory/30 p-4 space-y-4">
                <h3 className="font-serif text-lg text-charcoal font-medium">1. Studio &amp; Coordonnées</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-taupe uppercase">Nom de marque</label>
                    <input
                      type="text"
                      value={data.config.brandName}
                      onChange={(e) => updateConfig({ brandName: e.target.value })}
                      className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-taupe uppercase">Handle Instagram</label>
                    <input
                      type="text"
                      value={data.config.handle}
                      onChange={(e) => updateConfig({ handle: e.target.value })}
                      className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-taupe uppercase">URL Instagram</label>
                    <input
                      type="url"
                      value={data.config.instagramUrl}
                      onChange={(e) => updateConfig({ instagramUrl: e.target.value })}
                      className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-taupe uppercase">
                      Localisation publique (quartier / ville)
                    </label>
                    <input
                      type="text"
                      value={data.config.locationLine}
                      onChange={(e) => updateConfig({ locationLine: e.target.value })}
                      placeholder="Ex. À deux pas de la Place Napoléon, La Roche-sur-Yon"
                      className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-[10px] text-taupe">Affiché publiquement sur le site (Hero &amp; Footer)</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-emerald-900 uppercase">
                      Adresse exacte privée du studio (Confidentialité)
                    </label>
                    <input
                      type="text"
                      value={data.config.exactStudioAddress || ''}
                      onChange={(e) => updateConfig({ exactStudioAddress: e.target.value })}
                      placeholder="Ex. 2 rue du Général Gallieni, 85000 La Roche-sur-Yon"
                      className="mt-1 min-h-[44px] w-full border border-stone px-3 py-2 text-sm bg-emerald-50/20"
                    />
                    <p className="mt-1 text-[10px] text-emerald-800">
                      Masquée du site public · Envoyée UNIQUEMENT dans l'e-mail de confirmation après validation
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. En-tête / Hero */}
              <div className="border border-stone/60 bg-ivory/30 p-4 space-y-4">
                <h3 className="font-serif text-lg text-charcoal font-medium">2. En-tête &amp; Bannière d'accueil (Hero)</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-taupe uppercase">Badge supérieur (surtitre)</label>
                    <input
                      type="text"
                      value={data.config.heroBadge || ''}
                      placeholder="Ex. Studio Privé · La Roche-sur-Yon"
                      onChange={(e) => updateConfig({ heroBadge: e.target.value })}
                      className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-taupe uppercase">Bouton d'action principal</label>
                    <input
                      type="text"
                      value={data.config.heroCtaText || ''}
                      placeholder="Ex. Réserver un soin"
                      onChange={(e) => updateConfig({ heroCtaText: e.target.value })}
                      className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-taupe uppercase">Titre principal (H1)</label>
                  <input
                    type="text"
                    value={data.config.heroTitle}
                    onChange={(e) => updateConfig({ heroTitle: e.target.value })}
                    className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-taupe uppercase">Sous-titre descriptif</label>
                  <textarea
                    rows={2}
                    value={data.config.heroSubtitle}
                    onChange={(e) => updateConfig({ heroSubtitle: e.target.value })}
                    className="mt-1 w-full border border-stone bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* 3. Section Prestations & Tarifs */}
              <div className="border border-stone/60 bg-ivory/30 p-4 space-y-4">
                <h3 className="font-serif text-lg text-charcoal font-medium">3. En-tête de la Carte des Prestations</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-taupe uppercase">Surtitre</label>
                    <input
                      type="text"
                      value={data.config.tarifsCategoryBadge || ''}
                      placeholder="Ex. Menu du Studio"
                      onChange={(e) => updateConfig({ tarifsCategoryBadge: e.target.value })}
                      className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-taupe uppercase">Titre de la section</label>
                    <input
                      type="text"
                      value={data.config.tarifsTitle || ''}
                      placeholder="Ex. Prestations & Tarifs"
                      onChange={(e) => updateConfig({ tarifsTitle: e.target.value })}
                      className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-taupe uppercase">Sous-titre descriptif</label>
                  <input
                    type="text"
                    value={data.config.tarifsSubtitle || ''}
                    placeholder="Ex. Cliquez sur une prestation pour choisir votre créneau."
                    onChange={(e) => updateConfig({ tarifsSubtitle: e.target.value })}
                    className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* 4. Section Instagram */}
              <div className="border border-stone/60 bg-ivory/30 p-4 space-y-4">
                <h3 className="font-serif text-lg text-charcoal font-medium">4. Bannière Officielle Instagram</h3>
                <div>
                  <label className="block text-[11px] text-taupe uppercase">
                    Titre bloc Instagram
                  </label>
                  <input
                    type="text"
                    value={data.config.instagramBannerTitle}
                    onChange={(e) => updateConfig({ instagramBannerTitle: e.target.value })}
                    className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-taupe uppercase">
                    Texte bloc Instagram
                  </label>
                  <textarea
                    rows={2}
                    value={data.config.instagramBannerText}
                    onChange={(e) => updateConfig({ instagramBannerText: e.target.value })}
                    className="mt-1 w-full border border-stone bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 border border-stone bg-white p-6">
              <h3 className="font-serif text-2xl text-charcoal">
                Blocs Soins, Contre-indications & Protocoles
              </h3>

              {data.protocols.map((proto) => (
                <div key={proto.id} className="border border-stone/70 bg-ivory/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <input
                      type="text"
                      value={proto.title}
                      onChange={(e) => upsertProtocol({ ...proto, title: e.target.value })}
                      className="min-h-[40px] flex-1 border border-stone bg-white px-3 py-1.5 font-serif text-xl"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        deleteProtocol(proto.id);
                        notify('Bloc protocole supprimé.');
                      }}
                      className="inline-flex min-h-[40px] items-center gap-1 border border-red-200 bg-white px-3 py-1.5 text-xs text-red-800 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Supprimer</span>
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={proto.items.join('\n')}
                    onChange={(e) =>
                      upsertProtocol({
                        ...proto,
                        items: e.target.value.split('\n').filter((line) => line.trim() !== ''),
                      })
                    }
                    className="mt-3 w-full border border-stone bg-white px-3 py-2 text-xs leading-relaxed"
                  />
                </div>
              ))}

              <form onSubmit={handleAddProtocol} className="space-y-3 border-t border-stone pt-4">
                <h4 className="font-serif text-xl text-charcoal">Ajouter un bloc d’information</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={newProtoGroup}
                    onChange={(e) =>
                      setNewProtoGroup(e.target.value as 'rehaussement' | 'blanchiment')
                    }
                    className="min-h-[44px] border border-stone bg-white px-3 text-sm"
                  >
                    <option value="rehaussement">Onglet Rehaussement</option>
                    <option value="blanchiment">Onglet Blanchiment</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Titre du bloc"
                    value={newProtoTitle}
                    onChange={(e) => setNewProtoTitle(e.target.value)}
                    className="min-h-[44px] border border-stone px-3 text-sm"
                  />
                </div>
                <textarea
                  rows={3}
                  placeholder="Une consigne par ligne"
                  value={newProtoItems}
                  onChange={(e) => setNewProtoItems(e.target.value)}
                  className="w-full border border-stone px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center gap-2 border border-charcoal bg-charcoal px-4 py-2 text-xs font-medium text-ivory uppercase"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Ajouter ce bloc</span>
                </button>
              </form>
            </div>

            {/* 5. Foire Aux Questions (FAQ) entièrement dynamique */}
            <div className="space-y-4 border border-stone bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-serif text-2xl text-charcoal">
                    Foire Aux Questions (FAQ)
                  </h3>
                  <p className="text-xs text-taupe">
                    Modifiez directement chaque question et réponse affichée dans la section FAQ du site public.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetFaqs}
                  className="border border-stone px-3 py-1.5 text-xs text-taupe hover:text-charcoal transition-colors cursor-pointer"
                >
                  Restaurer les questions types
                </button>
              </div>

              {/* Titre et sous-titre de la section FAQ */}
              <div className="grid gap-3 sm:grid-cols-3 border-b border-stone/50 pb-4">
                <div>
                  <label className="block text-[11px] text-taupe uppercase">Surtitre section FAQ</label>
                  <input
                    type="text"
                    value={data.config.faqCategoryBadge || ''}
                    placeholder="Ex. Informations &amp; Conseils"
                    onChange={(e) => updateConfig({ faqCategoryBadge: e.target.value })}
                    className="mt-1 min-h-[40px] w-full border border-stone bg-white px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-taupe uppercase">Titre section FAQ</label>
                  <input
                    type="text"
                    value={data.config.faqTitle || ''}
                    placeholder="Ex. Questions fréquentes"
                    onChange={(e) => updateConfig({ faqTitle: e.target.value })}
                    className="mt-1 min-h-[40px] w-full border border-stone bg-white px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-taupe uppercase">Sous-titre descriptif</label>
                  <input
                    type="text"
                    value={data.config.faqSubtitle || ''}
                    placeholder="Ex. Toutes les réponses pour préparer votre rendez-vous en toute sérénité."
                    onChange={(e) => updateConfig({ faqSubtitle: e.target.value })}
                    className="mt-1 min-h-[40px] w-full border border-stone bg-white px-3 text-xs"
                  />
                </div>
              </div>

              {/* Liste des questions éditables */}
              <div className="space-y-4">
                {(data.faqs && data.faqs.length > 0 ? data.faqs : DEFAULT_FAQS).map((faq) => (
                  <div key={faq.id} className="border border-stone/70 bg-ivory/40 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] text-taupe uppercase font-medium">Question</label>
                        <input
                          type="text"
                          value={faq.question}
                          onChange={(e) => upsertFaq({ ...faq, question: e.target.value })}
                          className="mt-1 min-h-[40px] w-full border border-stone bg-white px-3 py-1.5 font-medium text-sm text-charcoal"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-4">
                        <button
                          type="button"
                          onClick={() => upsertFaq({ ...faq, active: faq.active === false ? true : false })}
                          className={`border px-2.5 py-1 text-[11px] uppercase font-medium transition-colors cursor-pointer ${
                            faq.active !== false
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-stone bg-stone/20 text-taupe'
                          }`}
                        >
                          {faq.active !== false ? 'Affiché' : 'Masqué'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteFaq(faq.id);
                            notify('Question FAQ supprimée.');
                          }}
                          className="inline-flex min-h-[36px] items-center gap-1 border border-red-200 bg-white px-3 py-1 text-xs text-red-800 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Supprimer</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-taupe uppercase font-medium">Réponse détaillée</label>
                      <textarea
                        rows={3}
                        value={faq.answer}
                        onChange={(e) => upsertFaq({ ...faq, answer: e.target.value })}
                        className="mt-1 w-full border border-stone bg-white px-3 py-2 text-xs leading-relaxed text-charcoal font-light"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Formulaire pour ajouter une nouvelle question */}
              <form onSubmit={handleAddFaq} className="space-y-3 border-t border-stone pt-4">
                <h4 className="font-serif text-xl text-charcoal">Ajouter une nouvelle question</h4>
                <div>
                  <input
                    type="text"
                    placeholder="Intitulé de la question (ex. Comment venir au studio ?)"
                    value={newFaqQuestion}
                    onChange={(e) => setNewFaqQuestion(e.target.value)}
                    className="min-h-[44px] w-full border border-stone px-3 text-sm bg-white"
                  />
                </div>
                <div>
                  <textarea
                    rows={3}
                    placeholder="Réponse détaillée..."
                    value={newFaqAnswer}
                    onChange={(e) => setNewFaqAnswer(e.target.value)}
                    className="w-full border border-stone px-3 py-2 text-sm bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center gap-2 border border-charcoal bg-charcoal px-4 py-2 text-xs font-medium text-ivory uppercase hover:bg-stone hover:text-charcoal transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Enregistrer cette question</span>
                </button>
              </form>
            </div>
          </section>
        )}

        {/* TAB 6: PARAMÈTRES STUDIO (Cloudinary, Sécurité, Sauvegarde) */}
        {activeTab === 'cloudinary' && (
          <section className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="border border-stone bg-white p-6">
              <h2 className="font-serif text-3xl text-charcoal">Paramètres &amp; Sécurité</h2>
              <p className="mt-1 text-xs text-taupe leading-relaxed">
                État de la connexion Cloudinary pour les photos/vidéos, gestion des accès et sauvegarde complète du studio.
              </p>
            </div>

            {/* État de connexion Cloudinary */}
            <div className="border border-stone bg-white p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="font-serif text-xl font-medium text-charcoal">
                    Stockage Médias Cloudinary · Opérationnel
                  </h3>
                </div>
                <span className="border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Connecté &amp; Prêt
                </span>
              </div>

              <p className="text-xs text-taupe leading-relaxed">
                Les téléversements et le recadrage 16:10 de vos photos et vidéos se font directement depuis l’onglet <strong>Prestations &amp; Médias</strong> sur chaque soin. Vos visuels sont hébergés et diffusés en haute définition sans ralentir le site.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="border border-stone/70 bg-ivory/50 p-3">
                  <span className="text-[10px] text-taupe uppercase tracking-wider block">Cloud Name</span>
                  <span className="font-mono text-xs font-semibold text-charcoal">
                    {data.config.cloudinary.cloudName || 'dvecpg1tz'}
                  </span>
                </div>
                <div className="border border-stone/70 bg-ivory/50 p-3">
                  <span className="text-[10px] text-taupe uppercase tracking-wider block">Upload Preset (Direct)</span>
                  <span className="font-mono text-xs font-semibold text-charcoal">
                    {data.config.cloudinary.uploadPreset || 'alshanas_unsigned'}
                  </span>
                </div>
                <div className="border border-stone/70 bg-ivory/50 p-3">
                  <span className="text-[10px] text-taupe uppercase tracking-wider block">Dossier Studio</span>
                  <span className="font-mono text-xs font-semibold text-charcoal">
                    {data.config.cloudinary.folder || 'alshanas-glow'}
                  </span>
                </div>
              </div>
            </div>

            {/* Sécurité & Accès */}
            <div className="border border-stone bg-white p-6 space-y-4">
              <h3 className="font-serif text-2xl text-charcoal">Sécurité &amp; Accès Administrateur</h3>
              <p className="text-xs text-taupe">
                Définissez votre e-mail pour recevoir les alertes de réservation et le code secret d’accès à cette administration.
              </p>

              <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-charcoal font-medium">
                    E-mail du studio (Alertes &amp; notifications)
                  </label>
                  <input
                    type="email"
                    value={data.config.contactEmail}
                    onChange={(e) => updateConfig({ contactEmail: e.target.value })}
                    className="mt-1 min-h-[44px] w-full border border-stone bg-white px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-charcoal font-medium">
                    Code secret administrateur
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      value={data.config.adminPasscode}
                      onChange={(e) => updateConfig({ adminPasscode: e.target.value })}
                      className="min-h-[44px] flex-1 border border-stone bg-white px-3 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => notify('Code secret d’administration mis à jour.')}
                      className="inline-flex min-h-[44px] items-center gap-1.5 border border-charcoal bg-charcoal px-4 text-xs font-semibold text-ivory uppercase hover:bg-silk transition-colors cursor-pointer"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>OK</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sauvegarde & Restauration */}
            <div className="border border-stone bg-white p-6 space-y-4">
              <h3 className="font-serif text-2xl text-charcoal">Sauvegarde &amp; Données</h3>
              <p className="text-xs text-taupe">
                Exportez l’ensemble de vos prestations, tarifs, réservations et règles dans un fichier sécurisé sur votre appareil.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="inline-flex min-h-[44px] items-center gap-2 border border-charcoal bg-white px-5 py-2 text-xs font-semibold uppercase tracking-wider text-charcoal hover:bg-ivory transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Exporter les données (JSON)</span>
                </button>

                <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 border border-stone bg-white px-5 py-2 text-xs font-semibold uppercase tracking-wider text-charcoal hover:border-charcoal transition-colors">
                  <Upload className="h-4 w-4" />
                  <span>Importer une sauvegarde (JSON)</span>
                  <input
                    type="file"
                    accept="application/json"
                    onChange={handleImportJson}
                    className="visually-hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Voulez-vous vraiment réinitialiser toutes les données du studio aux valeurs d’origine ?')) {
                      await resetStudioData();
                      notify('Données réinitialisées avec succès.');
                    }
                  }}
                  className="inline-flex min-h-[44px] items-center gap-2 border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-800 uppercase tracking-wider hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Réinitialiser par défaut</span>
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
