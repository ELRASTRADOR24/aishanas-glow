export type StandardCategory = 'extensions' | 'depose' | 'rehaussement' | 'blanchiment';
export type ServiceCategory = StandardCategory | (string & {});

export interface ServiceItem {
  id: string;
  category: ServiceCategory;
  name: string;
  subtitle?: string;
  fullPrice: number;
  fullLabel?: string;
  refillPrice?: number | null;
  refillLabel?: string;
  durationMinutes: number;
  description: string;
  note?: string;
  imageUrl?: string;
  showImage?: boolean;
  mediaFormat?: 'dynamic' | 'vertical' | 'square' | 'horizontal';
  supportsLashOptions?: boolean;
  active: boolean;
}

export interface ServiceAddon {
  id: string;
  name: string;
  description: string;
  price: number;
  priceLabel?: string;
  applicableCategories: ServiceCategory[];
  active: boolean;
}

export interface ProtocolBlock {
  id: string;
  group: 'rehaussement' | 'blanchiment';
  title: string;
  intro?: string;
  items: string[];
  highlight?: boolean;
}

export interface MediaAsset {
  id: string;
  label: string;
  url: string;
  publicId?: string;
  category: ServiceCategory | 'editorial';
  createdAt: string;
}

export interface BlockedSlot {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

export interface BookingRules {
  flexibleHours: boolean; // true = client chooses any desired time (Instagram model)
  lateHourThreshold: number; // e.g., 19 => after 19:00
  supplementAmount: number; // e.g., 10 EUR
  supplementNote: string;
  refillPolicyNote: string;
  standardSlots: string[];
  eveningSlots: string[];
  sundayEnabled: boolean;
  closedWeekdays: number[]; // 0 (Sunday) .. 6 (Saturday)
  blockedDates: string[]; // YYYY-MM-DD
  blockedSlots: BlockedSlot[];
  holidays: string[]; // YYYY-MM-DD
}

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
  folder: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  active?: boolean;
}

export interface StudioConfig {
  brandName: string;
  handle: string;
  instagramUrl: string;
  tagline: string;
  locationLine: string; // Quartier/indication publique (ex: À deux pas de la Place Napoléon, La Roche-sur-Yon)
  exactStudioAddress?: string; // Adresse privée envoyée UNIQUEMENT à la confirmation par l'administrateur
  city: string;
  certificationLine: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBadge?: string;
  heroCtaText?: string;
  heroSecondaryCtaText?: string;
  tarifsTitle?: string;
  tarifsSubtitle?: string;
  tarifsCategoryBadge?: string;
  protocolsTitle?: string;
  protocolsSubtitle?: string;
  protocolsCategoryBadge?: string;
  faqTitle?: string;
  faqSubtitle?: string;
  faqCategoryBadge?: string;
  instagramBannerTitle: string;
  instagramBannerText: string;
  contactEmail: string; // Admin Gmail receiving new booking alerts
  adminPasscode: string;
  showServiceImages?: boolean;
  cloudinary: CloudinaryConfig;
  bookingRules: BookingRules;
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type BookingVariant = 'full' | 'refill' | 'tint' | 'standard';

export interface BookingRequest {
  id: string;
  reference: string;
  createdAt: string;
  status: BookingStatus;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientInstagram: string;
  serviceId: string;
  serviceName: string;
  category: ServiceCategory;
  variant: BookingVariant;
  variantLabel: string;
  addonIds: string[];
  addonNames: string[];
  preferredDate: string;
  preferredTime: string;
  isSupplementApplied: boolean;
  supplementReason?: string;
  basePrice: number;
  addonsPrice: number;
  supplementPrice: number;
  totalPrice: number;
  contraindicationsConfirmed: boolean;
  notes?: string;
  adminDecisionNote?: string;
  source: 'web' | 'admin';
}

export interface OccupiedSlot {
  date: string;
  time: string;
  status: BookingStatus;
  durationMinutes?: number;
}

export interface EmailLogEntry {
  id: string;
  createdAt: string;
  to: string;
  subject: string;
  kind: 'admin_alert' | 'client_confirmed' | 'client_declined' | 'test';
  status: 'sent' | 'logged_no_smtp' | 'error';
  detail: string;
  previewText: string;
}

export interface SmtpStatus {
  configured: boolean;
  provider: 'resend' | 'gmail' | 'none';
  gmailUser: string;
  resendFrom: string;
  hasResendKey: boolean;
}

export interface StudioData {
  config: StudioConfig;
  services: ServiceItem[];
  addons: ServiceAddon[];
  protocols: ProtocolBlock[];
  media: MediaAsset[];
  faqs?: FaqItem[];
  bookings: BookingRequest[];
  occupiedSlots: OccupiedSlot[];
  emailLogs: EmailLogEntry[];
  smtpStatus: SmtpStatus;
}
