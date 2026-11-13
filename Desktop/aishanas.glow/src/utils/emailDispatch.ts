import type { BookingRequest } from '../types/studio';
import { buildBookingClipboardSummary } from './bookingLogic';

export interface ServerEmailNotification {
  delivered: boolean;
  status: 'sent' | 'logged_no_smtp' | 'error';
  message: string;
}

export function buildBookingMailtoUrl(booking: BookingRequest, recipient: string): string {
  const subject = `Demande de rendez-vous ${booking.reference} — ${booking.serviceName}`;
  const body = buildBookingClipboardSummary(booking);
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
