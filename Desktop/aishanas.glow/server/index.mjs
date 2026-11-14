import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import { DEFAULT_SERVER_STUDIO } from './defaultData.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env');

function loadDotEnv() {
  try {
    if (!fs.existsSync(ENV_FILE)) return;
    const raw = fs.readFileSync(ENV_FILE, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore malformed .env
  }
}

loadDotEnv();

const IS_VERCEL = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = IS_VERCEL || !fs.existsSync(path.join(__dirname, 'data'))
  ? path.join('/tmp', 'alshanas-data')
  : path.join(__dirname, 'data');
const STUDIO_FILE = path.join(DATA_DIR, 'studio.json');
const SECRETS_FILE = path.join(DATA_DIR, 'smtp.json');

const DEFAULT_RESEND_KEY = process.env.RESEND_API_KEY || '';
const DEFAULT_RESEND_FROM = process.env.RESEND_FROM || "Alshana's Glow <contact@xn--dynaceglobalsant-top-q2b.com>";
export const SITE_URL = process.env.SITE_URL || 'https://aishanas-glow.vercel.app';

const MONGODB_URI = process.env.MONGODB_URI?.trim() || '';

// MongoDB / Mongoose persistent schemas
const StudioDocSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'main' },
    data: { type: Object, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'studio_data', strict: false }
);

const BookingDocSchema = new mongoose.Schema(
  {
    id: { type: String, unique: true, required: true },
    reference: { type: String, required: true },
    createdAt: { type: String, required: true },
    status: { type: String, required: true },
    clientName: String,
    clientPhone: String,
    clientEmail: String,
    clientInstagram: String,
    serviceId: String,
    serviceName: String,
    category: String,
    variant: String,
    variantLabel: String,
    addonIds: [String],
    addonNames: [String],
    preferredDate: String,
    preferredTime: String,
    isSupplementApplied: Boolean,
    supplementReason: String,
    basePrice: Number,
    addonsPrice: Number,
    supplementPrice: Number,
    totalPrice: Number,
    contraindicationsConfirmed: Boolean,
    notes: String,
    source: String,
    adminDecisionNote: String,
  },
  { collection: 'bookings', strict: false }
);

const StudioModel = mongoose.models.StudioDoc || mongoose.model('StudioDoc', StudioDocSchema);
const BookingModel = mongoose.models.BookingDoc || mongoose.model('BookingDoc', BookingDocSchema);

let isMongoConnected = false;
let mongoConnPromise = null;

async function getMongoConnection() {
  if (!MONGODB_URI) {
    return false;
  }
  if (isMongoConnected && mongoose.connection.readyState === 1) return true;
  if (mongoConnPromise) return mongoConnPromise;

  mongoConnPromise = (async () => {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        bufferCommands: false,
      });
      isMongoConnected = true;
      console.log('[MongoDB Atlas] Connecté avec succès à la base alshanas_glow');
      await syncStudioFromMongo();
      return true;
    } catch (err) {
      console.warn('[MongoDB Atlas Warning] Connexion différée:', err?.message);
      isMongoConnected = false;
      return false;
    } finally {
      mongoConnPromise = null;
    }
  })();

  return mongoConnPromise;
}

// Background initial connect if MONGODB_URI is set
if (MONGODB_URI) {
  getMongoConnection().catch(() => {});
}

try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch {
  // Ignore in read-only environment
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw || !raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonSafe(filePath, value) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
    }
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`[writeJsonSafe] Non-fatal write error (${filePath}):`, err?.message);
  }
}

let memoryStudio = null;

async function syncStudioFromMongo() {
  try {
    const doc = await StudioModel.findOne({ key: 'main' }).lean();
    if (doc?.data) {
      const merged = {
        ...DEFAULT_SERVER_STUDIO,
        ...doc.data,
        config: {
          ...DEFAULT_SERVER_STUDIO.config,
          ...(doc.data.config || {}),
          cloudinary: {
            cloudName:
              doc.data.config?.cloudinary?.cloudName ||
              process.env.CLOUDINARY_CLOUD_NAME ||
              process.env.VITE_CLOUDINARY_CLOUD_NAME ||
              'dvecpg1tz',
            uploadPreset:
              doc.data.config?.cloudinary?.uploadPreset ||
              process.env.CLOUDINARY_UPLOAD_PRESET ||
              process.env.VITE_CLOUDINARY_UPLOAD_PRESET ||
              'alshanas_unsigned',
            folder:
              doc.data.config?.cloudinary?.folder ||
              process.env.CLOUDINARY_FOLDER ||
              process.env.VITE_CLOUDINARY_FOLDER ||
              'alshanas-glow',
          },
        },
      };
      const mongoBookings = await BookingModel.find({}).sort({ createdAt: -1 }).lean();
      if (mongoBookings && mongoBookings.length > 0) {
        merged.bookings = mongoBookings.map((b) => {
          const { _id, __v, ...rest } = b;
          return rest;
        });
      }
      memoryStudio = merged;
      writeJsonSafe(STUDIO_FILE, memoryStudio);
    } else {
      const current = loadStudio();
      await StudioModel.findOneAndUpdate(
        { key: 'main' },
        { data: current, updatedAt: new Date() },
        { upsert: true }
      );
    }
  } catch (err) {
    console.warn('[MongoDB Sync Warning]:', err?.message);
  }
}

function loadStudio() {
  if (memoryStudio) return memoryStudio;
  let existing = readJsonSafe(STUDIO_FILE, null);
  if (!existing) {
    const localSeed = path.join(__dirname, 'data', 'studio.json');
    existing = readJsonSafe(localSeed, null);
  }
  if (!existing) {
    memoryStudio = structuredClone(DEFAULT_SERVER_STUDIO);
    writeJsonSafe(STUDIO_FILE, memoryStudio);
    return memoryStudio;
  }

  const existingConfig = existing.config || {};
  const isOldAddressInLocation = existingConfig.locationLine?.includes('Gallieni');
  const safeLocation = isOldAddressInLocation
    ? 'À deux pas de la Place Napoléon, La Roche-sur-Yon'
    : existingConfig.locationLine || DEFAULT_SERVER_STUDIO.config.locationLine;
  const exactAddress =
    existingConfig.exactStudioAddress || '2 rue du Général Gallieni, 85000 La Roche-sur-Yon';

  const sanitizedServices = (existing.services || DEFAULT_SERVER_STUDIO.services).map((s) => {
    let duration = s.durationMinutes;
    let active = s.active;
    if (s.category === 'extensions') {
      duration = 120;
    }
    if (s.category === 'blanchiment' && active !== false) {
      active = false;
    }
    return { ...s, durationMinutes: duration, active };
  });

  memoryStudio = {
    ...DEFAULT_SERVER_STUDIO,
    ...existing,
    config: {
      ...DEFAULT_SERVER_STUDIO.config,
      ...existingConfig,
      locationLine: safeLocation,
      exactStudioAddress: exactAddress,
      tagline: existingConfig.tagline?.includes('Blanchiment')
        ? 'Extensions de cils & Rehaussement de cils'
        : existingConfig.tagline || DEFAULT_SERVER_STUDIO.config.tagline,
      heroSubtitle: existingConfig.heroSubtitle?.toLowerCase().includes('blanchiment')
        ? 'Extensions de cils et rehaussement soin profond à La Roche-sur-Yon. Consultez la carte des prestations et réservez votre créneau directement en ligne.'
        : existingConfig.heroSubtitle || DEFAULT_SERVER_STUDIO.config.heroSubtitle,
      cloudinary: {
        cloudName:
          existingConfig.cloudinary?.cloudName ||
          process.env.CLOUDINARY_CLOUD_NAME ||
          process.env.VITE_CLOUDINARY_CLOUD_NAME ||
          DEFAULT_SERVER_STUDIO.config.cloudinary.cloudName,
        uploadPreset:
          existingConfig.cloudinary?.uploadPreset ||
          process.env.CLOUDINARY_UPLOAD_PRESET ||
          process.env.VITE_CLOUDINARY_UPLOAD_PRESET ||
          DEFAULT_SERVER_STUDIO.config.cloudinary.uploadPreset,
        folder:
          existingConfig.cloudinary?.folder ||
          process.env.CLOUDINARY_FOLDER ||
          process.env.VITE_CLOUDINARY_FOLDER ||
          DEFAULT_SERVER_STUDIO.config.cloudinary.folder,
      },
      bookingRules: {
        ...DEFAULT_SERVER_STUDIO.config.bookingRules,
        ...(existingConfig.bookingRules || {}),
        closedWeekdays: existingConfig.bookingRules?.closedWeekdays || [],
        blockedDates: existingConfig.bookingRules?.blockedDates || [],
        blockedSlots: existingConfig.bookingRules?.blockedSlots || [],
      },
    },
    services: sanitizedServices,
    addons: existing.addons || DEFAULT_SERVER_STUDIO.addons,
    protocols: existing.protocols || DEFAULT_SERVER_STUDIO.protocols,
    media: existing.media || [],
    bookings: existing.bookings || [],
    emailLogs: existing.emailLogs || [],
  };
  return memoryStudio;
}

function saveStudio(studio) {
  memoryStudio = studio;
  writeJsonSafe(STUDIO_FILE, studio);
  getMongoConnection().then((connected) => {
    if (connected) {
      StudioModel.findOneAndUpdate(
        { key: 'main' },
        { data: studio, updatedAt: new Date() },
        { upsert: true }
      ).catch((err) => console.warn('[MongoDB Studio Save Error]:', err?.message));
    }
  }).catch(() => {});
}

let memorySecrets = null;

function loadEmailSecrets() {
  if (memorySecrets) return memorySecrets;
  const envResend = process.env.RESEND_API_KEY?.trim() || '';
  const envResendFrom = process.env.RESEND_FROM?.trim() || '';
  const envUser = process.env.GMAIL_USER?.trim() || '';
  const envPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '') || '';

  const fileExists = fs.existsSync(SECRETS_FILE);
  const stored = readJsonSafe(SECRETS_FILE, {
    provider: '',
    resendApiKey: '',
    resendFrom: DEFAULT_RESEND_FROM,
    gmailUser: '',
    gmailAppPassword: '',
    tokenSecret: '',
  });

  if (!fileExists || !stored.tokenSecret) {
    stored.tokenSecret = stored.tokenSecret || crypto.randomBytes(32).toString('hex');
    writeJsonSafe(SECRETS_FILE, stored);
  }

  const resendApiKey = envResend || stored.resendApiKey || DEFAULT_RESEND_KEY;
  const resendFrom = envResendFrom || stored.resendFrom || DEFAULT_RESEND_FROM;
  const gmailUser = envUser || stored.gmailUser || '';
  const gmailAppPassword = envPass || stored.gmailAppPassword || '';

  let provider = stored.provider || '';
  if (!provider) {
    if (resendApiKey) provider = 'resend';
    else if (gmailUser && gmailAppPassword) provider = 'gmail';
    else provider = 'none';
  }

  memorySecrets = {
    provider,
    resendApiKey,
    resendFrom,
    gmailUser,
    gmailAppPassword,
    tokenSecret: stored.tokenSecret,
  };
  return memorySecrets;
}

function getEmailProviderStatus(secrets) {
  const resendReady = secrets.provider === 'resend' && Boolean(secrets.resendApiKey);
  const gmailReady =
    secrets.provider === 'gmail' && Boolean(secrets.gmailUser && secrets.gmailAppPassword);

  return {
    configured: resendReady || gmailReady,
    provider: resendReady ? 'resend' : gmailReady ? 'gmail' : secrets.provider || 'none',
    gmailUser: secrets.gmailUser,
    resendFrom: secrets.resendFrom,
    hasResendKey: Boolean(secrets.resendApiKey),
  };
}

function formatDateFr(dateStr) {
  if (!dateStr) return 'À convenir';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}

function evaluateSupplement(dateStr, timeStr, rules) {
  const suppAmount = Number(rules.supplementAmount ?? 10);
  if (suppAmount <= 0) return { applied: false, amount: 0, reason: '' };
  const reasons = [];
  if (dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y && m && d) {
      const dt = new Date(y, m - 1, d);
      if (dt.getDay() === 0) reasons.push('Dimanche');
      if ((rules.holidays || []).includes(dateStr)) reasons.push('Jour férié');
    }
  }
  if (timeStr) {
    const hour = Number(timeStr.split(':')[0]);
    if (!Number.isNaN(hour) && hour >= (rules.lateHourThreshold ?? 19)) {
      reasons.push(`Créneau à partir de ${rules.lateHourThreshold ?? 19}h`);
    }
  }
  if (reasons.length === 0) return { applied: false, amount: 0, reason: '' };
  return {
    applied: true,
    amount: suppAmount,
    reason: reasons.join(' & '),
  };
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const EMAIL_LOGO_LIGHT_PATH = path.join(PUBLIC_DIR, 'logo-eyes-light.png');
const EMAIL_LOGO_DARK_PATH = path.join(PUBLIC_DIR, 'logo-eyes-dark.png');

function loadInlineLogoAssets() {
  const assets = [];
  for (const [cid, filePath, filename] of [
    ['logo-eyes-light', EMAIL_LOGO_LIGHT_PATH, 'logo-eyes-light.png'],
    ['logo-eyes-dark', EMAIL_LOGO_DARK_PATH, 'logo-eyes-dark.png'],
  ]) {
    try {
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        assets.push({ cid, filename, buffer: buf, base64: buf.toString('base64') });
      }
    } catch {
      // Ignore missing logo asset gracefully
    }
  }
  return assets;
}

const INLINE_LOGO_ASSETS = loadInlineLogoAssets();

function createEmailHtml({
  studio,
  statusBadge,
  title,
  subtitle,
  rows,
  optionsList,
  totalLabel,
  totalValue,
  totalNote,
  noteTitle,
  noteBody,
  ctaLabel,
  ctaUrl,
  secondaryCtaLabel,
  secondaryCtaUrl,
  footer,
}) {
  const brandName = studio?.config?.brandName || "Alshana's Glow";
  const handle = studio?.config?.handle || '@alshanas.glow';
  const certificationLine = studio?.config?.certificationLine || 'Technicienne certifiée 3x';
  const city = studio?.config?.city || 'La Roche-sur-Yon (85000)';
  const locationLine =
    studio?.config?.locationLine || 'À deux pas de la Place Napoléon, La Roche-sur-Yon';
  const instagramUrl =
    studio?.config?.instagramUrl || 'https://www.instagram.com/alshanas.glow/';

  const hasLightLogo = INLINE_LOGO_ASSETS.some((a) => a.cid === 'logo-eyes-light');
  const hasDarkLogo = INLINE_LOGO_ASSETS.some((a) => a.cid === 'logo-eyes-dark');

  const rowHtml = rows
    .map(
      ([label, val]) => `
        <tr>
          <td style="padding:11px 0;border-bottom:1px solid #d8d1c7;color:#6f6860;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:11px 0 11px 12px;border-bottom:1px solid #d8d1c7;color:#171513;font-size:13px;font-weight:500;text-align:right;vertical-align:top;">${escapeHtml(val)}</td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f9f7f4;color:#171513;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9f7f4;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #171513;">
          <!-- BAND 1: OBSIDIAN SILK HERO HEADER MATCHING HERO.TSX -->
          <tr>
            <td align="center" bgcolor="#11100f" style="background-color:#11100f;background-image:linear-gradient(128deg,#0c0b0a 0%,#262320 45%,#12100e 100%);padding:34px 28px 30px 28px;border-bottom:1px solid #262320;">
              ${
                hasLightLogo
                  ? `<img src="cid:logo-eyes-light" alt="${escapeHtml(brandName)}" width="116" style="display:block;margin:0 auto 14px auto;width:116px;max-width:116px;height:auto;border:0;" />`
                  : ''
              }
              <p style="margin:0 0 8px 0;font-size:10px;font-weight:500;letter-spacing:2.6px;text-transform:uppercase;color:#d8d1c7;">
                ${escapeHtml(certificationLine)} &middot; ${escapeHtml(city)}
              </p>
              <p style="margin:0;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:32px;line-height:1.1;font-weight:400;letter-spacing:-0.01em;color:#f7f4ef;">
                ${escapeHtml(brandName)}
              </p>
              <p style="margin:8px 0 0 0;font-size:11px;letter-spacing:1.2px;color:#d8d1c7;">
                ${escapeHtml(locationLine)}
              </p>
            </td>
          </tr>

          <!-- BAND 2: PAPER WRAPPER WITH WHITE EDITORIAL CARD MATCHING TARIFFCARDS.TSX -->
          <tr>
            <td bgcolor="#f9f7f4" style="background-color:#f9f7f4;padding:26px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #d8d1c7;">
                <tr>
                  <td style="padding:30px 26px 28px 26px;">
                    <div style="text-align:center;margin-bottom:20px;">
                      ${
                        hasDarkLogo
                          ? `<img src="cid:logo-eyes-dark" alt="" width="84" style="display:block;margin:0 auto 12px auto;width:84px;max-width:84px;height:auto;border:0;" />`
                          : ''
                      }
                      ${
                        statusBadge
                          ? `<p style="display:inline-block;margin:0 0 12px 0;padding:5px 12px;border:1px solid #171513;background-color:#f9f7f4;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#171513;">${escapeHtml(statusBadge)}</p>`
                          : ''
                      }
                      <h1 style="margin:0 auto 10px auto;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;font-weight:500;color:#171513;border-bottom:1px solid #171513;display:inline-block;padding-bottom:5px;">
                        ${escapeHtml(title)}
                      </h1>
                      <p style="margin:10px 0 0 0;font-size:13px;line-height:1.6;color:#6f6860;">
                        ${escapeHtml(subtitle)}
                      </p>
                    </div>

                    <!-- EDITORIAL HAIRLINE ROWS -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #171513;">
                      ${rowHtml}
                    </table>

                    ${
                      optionsList && optionsList.length > 0
                        ? `
                    <div style="margin:20px 0 16px 0;padding:16px;background-color:#f9f7f4;border:1px solid #d8d1c7;">
                      <p style="margin:0 0 12px 0;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#171513;text-align:center;">
                        Sélectionnez votre créneau souhaité :
                      </p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        ${optionsList
                          .map((opt, i) => {
                            const label = typeof opt === 'string' ? opt : opt.label;
                            const link = typeof opt === 'string' ? `${SITE_URL}/confirmation-option` : opt.url;
                            return `
                          <tr>
                            <td style="padding:6px 0;">
                              <a href="${escapeHtml(link)}" style="display:block;padding:12px 14px;background-color:#ffffff;border:1px solid #171513;text-decoration:none;color:#171513;font-size:13px;font-weight:500;text-align:center;">
                                <span style="display:inline-block;padding:3px 8px;background-color:#171513;color:#ffffff;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-right:8px;">Option ${i + 1}</span>
                                <span>${escapeHtml(label)}</span>
                                <span style="display:inline-block;margin-left:8px;font-size:11px;color:#6f6860;">&rarr; Choisir</span>
                              </a>
                            </td>
                          </tr>`;
                          })
                          .join('')}
                      </table>
                    </div>`
                        : ''
                    }

                    <!-- ESTIMATED / CONFIRMED TOTAL BAR MATCHING BOOKINGSECTION.TSX -->
                    ${
                      totalValue
                        ? `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f9f7f4" style="margin-top:18px;background-color:#f9f7f4;border:1px solid #d8d1c7;">
                      <tr>
                        <td style="padding:16px 18px;vertical-align:middle;">
                          <p style="margin:0;font-size:10px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase;color:#6f6860;">${escapeHtml(totalLabel || 'Total estimé')}</p>
                          ${
                            totalNote
                              ? `<p style="margin:4px 0 0 0;font-size:11px;color:#6f6860;">${escapeHtml(totalNote)}</p>`
                              : ''
                          }
                        </td>
                        <td align="right" style="padding:16px 18px;vertical-align:middle;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:32px;line-height:1;font-weight:500;color:#171513;white-space:nowrap;">
                          ${escapeHtml(totalValue)}
                        </td>
                      </tr>
                    </table>`
                        : ''
                    }

                    <!-- HIGHLIGHT NOTE / STUDIO MESSAGE -->
                    ${
                      noteBody
                        ? `
                    <div style="margin-top:18px;padding:14px 16px;background-color:#f9f7f4;border-left:2px solid #171513;font-size:12px;line-height:1.6;color:#171513;">
                      ${noteTitle ? `<strong style="display:block;margin-bottom:3px;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:#171513;">${escapeHtml(noteTitle)}</strong>` : ''}
                      <span>${escapeHtml(noteBody)}</span>
                    </div>`
                        : ''
                    }

                    <!-- MONOCHROME RECTANGULAR CTA BUTTONS MATCHING WEBSITE -->
                    ${
                      ctaLabel && ctaUrl
                        ? `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
                      <tr>
                        <td align="center">
                          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background-color:#171513;border:1px solid #171513;color:#f9f7f4;padding:13px 26px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">
                            ${escapeHtml(ctaLabel)}
                          </a>
                          ${
                            secondaryCtaLabel && secondaryCtaUrl
                              ? `<div style="margin-top:10px;"><a href="${escapeHtml(secondaryCtaUrl)}" style="display:inline-block;background-color:#ffffff;border:1px solid #171513;color:#171513;padding:11px 22px;font-size:11px;font-weight:500;letter-spacing:1.8px;text-transform:uppercase;text-decoration:none;">${escapeHtml(secondaryCtaLabel)}</a></div>`
                              : ''
                          }
                        </td>
                      </tr>
                    </table>`
                        : ''
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BAND 3: OBSIDIAN FOOTER MATCHING FOOTER.TSX -->
          <tr>
            <td align="center" bgcolor="#0d0c0b" style="background-color:#0d0c0b;padding:24px 24px;color:#d8d1c7;">
              <p style="margin:0 0 6px 0;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-size:18px;color:#f7f4ef;">
                ${escapeHtml(brandName)}
              </p>
              <p style="margin:0 0 8px 0;font-size:11px;line-height:1.5;color:#d8d1c7;">
                ${escapeHtml(footer || `${locationLine} · ${handle}`)}
              </p>
              <p style="margin:0;font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:#8f877d;">
                <a href="${escapeHtml(instagramUrl)}" style="color:#d8d1c7;text-decoration:underline;">Instagram : ${escapeHtml(handle)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function dispatchEmail(studio, { to, subject, text, html, replyTo, kind }) {
  const secrets = loadEmailSecrets();
  const recipient = (to || '').trim();
  const entry = {
    id: `mail-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    to: recipient,
    subject,
    kind,
    status: 'logged_no_smtp',
    detail: '',
    previewText: text,
  };

  if (!recipient) {
    entry.status = 'error';
    entry.detail = 'Adresse destinataire vide.';
    studio.emailLogs = [entry, ...(studio.emailLogs || [])].slice(0, 100);
    writeJsonSafe(STUDIO_FILE, studio);
    return { delivered: false, status: entry.status, message: entry.detail };
  }

  // Path 1: Resend API
  if (secrets.provider === 'resend' && secrets.resendApiKey) {
    try {
      const resendAttachments = INLINE_LOGO_ASSETS.map((asset) => ({
        filename: asset.filename,
        content: asset.base64,
        content_id: asset.cid,
        content_type: 'image/png',
      }));

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secrets.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: secrets.resendFrom || "Alshana's Glow <onboarding@resend.dev>",
          to: [recipient],
          reply_to: replyTo || studio.config.contactEmail || undefined,
          subject,
          text,
          html,
          attachments: resendAttachments.length > 0 ? resendAttachments : undefined,
        }),
      });
      const resJson = await response.json().catch(() => null);
      if (!response.ok) {
        let errMsg =
          resJson?.message ||
          `Erreur Resend (${response.status}). Vérifiez votre clé API et le domaine expéditeur.`;
        if (
          response.status === 403 &&
          typeof resJson?.message === 'string' &&
          resJson.message.toLowerCase().includes('only send testing emails')
        ) {
          errMsg = `Restriction Resend mode test (onboarding@resend.dev) : envoi refusé vers ${recipient}. Sans domaine vérifié dans Resend, seul l’e-mail propriétaire du compte Resend peut recevoir. Vérifiez un domaine sur Resend ou basculez sur Gmail SMTP.`;
        }
        entry.status = 'error';
        entry.detail = errMsg;
        studio.emailLogs = [entry, ...(studio.emailLogs || [])].slice(0, 100);
        writeJsonSafe(STUDIO_FILE, studio);
        return { delivered: false, status: 'error', message: errMsg };
      }

      entry.status = 'sent';
      entry.detail = `E-mail envoyé via Resend (${resJson?.id || 'ok'}) vers ${recipient}.`;
      studio.emailLogs = [entry, ...(studio.emailLogs || [])].slice(0, 100);
      writeJsonSafe(STUDIO_FILE, studio);
      return { delivered: true, status: 'sent', message: entry.detail };
    } catch (err) {
      entry.status = 'error';
      entry.detail = err instanceof Error ? err.message : 'Erreur réseau Resend.';
      studio.emailLogs = [entry, ...(studio.emailLogs || [])].slice(0, 100);
      writeJsonSafe(STUDIO_FILE, studio);
      return { delivered: false, status: 'error', message: entry.detail };
    }
  }

  // Path 2: Nodemailer Gmail SMTP
  if (secrets.provider === 'gmail' && secrets.gmailUser && secrets.gmailAppPassword) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: secrets.gmailUser,
          pass: secrets.gmailAppPassword,
        },
      });

      await transporter.sendMail({
        from: `"${studio.config.brandName}" <${secrets.gmailUser}>`,
        to: recipient,
        replyTo: replyTo || studio.config.contactEmail || secrets.gmailUser,
        subject,
        text,
        html,
        attachments: INLINE_LOGO_ASSETS.map((asset) => ({
          filename: asset.filename,
          content: asset.buffer,
          cid: asset.cid,
          contentType: 'image/png',
        })),
      });

      entry.status = 'sent';
      entry.detail = `E-mail envoyé via Gmail SMTP (${secrets.gmailUser}) vers ${recipient}.`;
      studio.emailLogs = [entry, ...(studio.emailLogs || [])].slice(0, 100);
      writeJsonSafe(STUDIO_FILE, studio);
      return { delivered: true, status: 'sent', message: entry.detail };
    } catch (err) {
      entry.status = 'error';
      entry.detail = err instanceof Error ? err.message : 'Erreur SMTP Gmail.';
      studio.emailLogs = [entry, ...(studio.emailLogs || [])].slice(0, 100);
      writeJsonSafe(STUDIO_FILE, studio);
      return { delivered: false, status: 'error', message: entry.detail };
    }
  }

  entry.status = 'logged_no_smtp';
  entry.detail =
    'Envoi e-mail non activé : renseignez votre clé API Resend ou votre mot de passe d’application Gmail dans /admin > Notifications E-mail.';
  studio.emailLogs = [entry, ...(studio.emailLogs || [])].slice(0, 100);
  writeJsonSafe(STUDIO_FILE, studio);
  return { delivered: false, status: entry.status, message: entry.detail };
}

function issueToken(secret) {
  const payload = `${Date.now()}.${crypto.randomBytes(12).toString('hex')}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expected));
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const secrets = loadEmailSecrets();
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-admin-token'];
  if (!verifyToken(token, secrets.tokenSecret)) {
    return res.status(401).json({ error: 'Authentification administrateur requise.' });
  }
  next();
}

function buildPublicStudio(studio) {
  const { adminPasscode: _hidden, exactStudioAddress: _privateAddress, ...safeConfig } = studio.config;
  const occupiedSlots = (studio.bookings || [])
    .filter((b) => b.status === 'confirmed')
    .map((b) => ({ date: b.preferredDate, time: b.preferredTime, status: b.status }));
  const secrets = loadEmailSecrets();

  const publicLocation = safeConfig.locationLine?.includes('Gallieni')
    ? 'À deux pas de la Place Napoléon, La Roche-sur-Yon'
    : safeConfig.locationLine || 'À deux pas de la Place Napoléon, La Roche-sur-Yon';

  const publicTagline = safeConfig.tagline?.includes('Blanchiment')
    ? 'Extensions de cils & Rehaussement de cils'
    : safeConfig.tagline || 'Extensions de cils & Rehaussement de cils';

  const publicHeroSubtitle = safeConfig.heroSubtitle?.toLowerCase().includes('blanchiment')
    ? 'Extensions de cils et rehaussement soin profond à La Roche-sur-Yon. Consultez la carte des prestations et réservez votre créneau directement en ligne.'
    : safeConfig.heroSubtitle;

  const publicServices = (studio.services || []).map((s) => {
    if (s.category === 'extensions') {
      return { ...s, durationMinutes: 120 };
    }
    if (s.category === 'blanchiment') {
      return { ...s, active: false };
    }
    return s;
  });

  return {
    config: {
      ...safeConfig,
      tagline: publicTagline,
      heroSubtitle: publicHeroSubtitle,
      locationLine: publicLocation,
      exactStudioAddress: '',
      adminPasscode: '',
    },
    services: publicServices,
    addons: studio.addons,
    protocols: (studio.protocols || []).filter(
      (p) => p.group !== 'blanchiment' || publicServices.some((s) => s.category === 'blanchiment' && s.active)
    ),
    media: studio.media,
    bookings: [],
    occupiedSlots,
    emailLogs: [],
    smtpStatus: getEmailProviderStatus(secrets),
  };
}

function buildAdminStudio(studio) {
  const secrets = loadEmailSecrets();
  const occupiedSlots = (studio.bookings || [])
    .filter((b) => b.status === 'confirmed')
    .map((b) => ({ date: b.preferredDate, time: b.preferredTime, status: b.status }));

  return {
    ...studio,
    occupiedSlots,
    emailLogs: studio.emailLogs || [],
    smtpStatus: getEmailProviderStatus(secrets),
  };
}

const app = express();
app.use(express.json({ limit: '2mb' }));

// Diagnostic health ping
app.get('/api/health', async (_req, res) => {
  await getMongoConnection().catch(() => {});
  res.json({
    ok: true,
    isVercel: IS_VERCEL,
    siteUrl: SITE_URL,
    tmpExists: fs.existsSync('/tmp'),
    mongoConnected: mongoose.connection.readyState === 1,
    database: 'MongoDB Atlas (cluster0.tmgtwyi.mongodb.net/alshanas_glow)',
  });
});

// Public studio read
app.get('/api/studio', (_req, res, next) => {
  try {
    const studio = loadStudio();
    res.json(buildPublicStudio(studio));
  } catch (err) {
    next(err);
  }
});

// Client submits booking -> Email #1 sent to Admin Gmail
app.post('/api/bookings', async (req, res, next) => {
  try {
    const studio = loadStudio();
    const rules = studio.config.bookingRules;
    const body = req.body || {};

    const clientName = String(body.clientName || '').trim();
    const clientPhone = String(body.clientPhone || '').trim();
    const clientEmail = String(body.clientEmail || '').trim();
    const clientInstagram = String(body.clientInstagram || '').trim();
    const preferredDate = String(body.preferredDate || '').trim();
    const preferredTime = String(body.preferredTime || '').trim();
    const serviceId = String(body.serviceId || '').trim();
    const variant = String(body.variant || 'full');
    const addonIds = Array.isArray(body.addonIds) ? body.addonIds : [];
    const notes = String(body.notes || '').trim();
    const contraindicationsConfirmed = Boolean(body.contraindicationsConfirmed);

    if (!clientName || !clientPhone || !clientEmail || !preferredDate || !preferredTime || !serviceId) {
      return res.status(400).json({
        error: 'Merci de renseigner votre nom, téléphone, e-mail, prestation, date et heure.',
      });
    }
    if (!/^\d{2}:\d{2}$/.test(preferredTime)) {
      return res.status(400).json({
        error: 'Veuillez choisir une heure valide.',
      });
    }

    const service = studio.services.find((s) => s.id === serviceId && s.active);
    if (!service) {
      return res.status(404).json({ error: 'Prestation introuvable ou inactive.' });
    }

    if (service.category === 'blanchiment' && !contraindicationsConfirmed) {
      return res.status(400).json({
        error: 'Veuillez confirmer les contre-indications du blanchiment dentaire.',
      });
    }

    const [y, m, d] = preferredDate.split('-').map(Number);
    const weekday = new Date(y, m - 1, d).getDay();
    if (!rules.sundayEnabled && weekday === 0) {
      return res.status(409).json({ error: 'Le studio est fermé le dimanche.' });
    }
    if ((rules.closedWeekdays || []).includes(weekday) || (rules.blockedDates || []).includes(preferredDate)) {
      return res.status(409).json({ error: 'Cette journée est fermée à la réservation.' });
    }
    const slotBlocked = (rules.blockedSlots || []).some(
      (s) => s.date === preferredDate && s.time === preferredTime
    );
    const slotConfirmed = (studio.bookings || []).some(
      (b) => b.status === 'confirmed' && b.preferredDate === preferredDate && b.preferredTime === preferredTime
    );
    if (slotBlocked || slotConfirmed) {
      return res.status(409).json({
        error: 'Ce créneau vient d’être réservé ou bloqué. Veuillez choisir un autre horaire.',
      });
    }

    let basePrice = service.fullPrice;
    let variantLabel = service.fullLabel || 'Pose complète';
    if ((variant === 'refill' || variant === 'tint') && service.refillPrice != null) {
      basePrice = service.refillPrice;
      variantLabel = service.refillLabel || (variant === 'tint' ? 'Avec teinture' : 'Remplissage 3 semaines');
    }

    const selectedAddons = studio.addons.filter((a) => a.active && addonIds.includes(a.id));
    const addonsPrice = selectedAddons.reduce((sum, a) => sum + Number(a.price || 0), 0);
    const sup = evaluateSupplement(preferredDate, preferredTime, rules);
    const totalPrice = basePrice + addonsPrice + sup.amount;

    const normalizedIg = clientInstagram
      ? clientInstagram.startsWith('@')
        ? clientInstagram
        : `@${clientInstagram}`
      : '';

    const booking = {
      id: `bk-${Date.now()}`,
      reference: `AG-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      status: 'pending',
      clientName,
      clientPhone,
      clientEmail,
      clientInstagram: normalizedIg,
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      variant,
      variantLabel,
      addonIds: selectedAddons.map((a) => a.id),
      addonNames: selectedAddons.map((a) => a.name),
      preferredDate,
      preferredTime,
      isSupplementApplied: sup.applied,
      supplementReason: sup.reason || undefined,
      basePrice,
      addonsPrice,
      supplementPrice: sup.amount,
      totalPrice,
      contraindicationsConfirmed,
      notes: notes || undefined,
      source: 'web',
    };

    studio.bookings = [booking, ...(studio.bookings || [])];
    saveStudio(studio);
    BookingModel.findOneAndUpdate({ id: booking.id }, booking, { upsert: true }).catch(() => {});

    const adminRecipient = studio.config.contactEmail || 'alshanasglow@gmail.com';
    const siteUrl = SITE_URL;
    const subject = `[${studio.config.brandName}] Nouvelle demande à valider (${booking.reference}) — ${booking.clientName}`;
    const text = [
      `Nouvelle demande de rendez-vous sur ${studio.config.brandName}`,
      `Référence : ${booking.reference}`,
      `Cliente : ${booking.clientName}`,
      `E-mail cliente : ${booking.clientEmail}`,
      `Téléphone : ${booking.clientPhone}`,
      booking.clientInstagram ? `Instagram : ${booking.clientInstagram}` : null,
      `Prestation : ${booking.serviceName} (${booking.variantLabel})`,
      booking.addonNames.length > 0 ? `Options : ${booking.addonNames.join(', ')}` : null,
      `Date demandée : ${formatDateFr(booking.preferredDate)}`,
      `Heure demandée : ${booking.preferredTime}`,
      booking.isSupplementApplied ? `Supplément : +${booking.supplementPrice} € (${booking.supplementReason})` : null,
      `Total estimé : ${booking.totalPrice} €`,
      booking.notes ? `Précisions : ${booking.notes}` : null,
      ``,
      `Validez ou ajustez ce créneau dans l’administration : ${siteUrl}/admin`,
    ]
      .filter(Boolean)
      .join('\n');

    const html = createEmailHtml({
      studio,
      statusBadge: `Nouvelle demande · ${booking.reference}`,
      title: `Validation requise — ${booking.clientName}`,
      subtitle: `${booking.clientName} souhaite réserver un créneau. Validez, ajustez l’horaire ou refusez cette fiche dans votre espace administrateur.`,
      rows: [
        ['Référence', booking.reference],
        ['Cliente', booking.clientName],
        ['E-mail cliente', booking.clientEmail],
        ['Téléphone', booking.clientPhone],
        ['Instagram', booking.clientInstagram || 'Non renseigné'],
        ['Prestation', `${booking.serviceName} (${booking.variantLabel})`],
        ['Options', booking.addonNames.length > 0 ? booking.addonNames.join(', ') : 'Aucune'],
        ['Date demandée', formatDateFr(booking.preferredDate)],
        ['Heure souhaitée', booking.preferredTime],
      ],
      totalLabel: 'Total estimé de la prestation',
      totalValue: `${booking.totalPrice} €`,
      totalNote: booking.isSupplementApplied
        ? `Inclut le supplément +${booking.supplementPrice} € (${booking.supplementReason})`
        : 'Règle standard appliquée',
      noteTitle: booking.notes ? 'Message de la cliente' : 'Action attendue',
      noteBody:
        booking.notes ||
        'Connectez-vous à l’administration pour confirmer ce créneau et déclencher l’e-mail de validation vers la cliente.',
      ctaLabel: 'Valider ou ajuster dans /admin',
      ctaUrl: `${siteUrl}/admin`,
      footer: `Notification administrateur envoyée à ${adminRecipient} · ${studio.config.brandName}`,
    });

    let emailNotification = null;
    try {
      emailNotification = await dispatchEmail(studio, {
        to: adminRecipient,
        replyTo: booking.clientEmail,
        subject,
        text,
        html,
        kind: 'admin_alert',
      });
    } catch (err) {
      console.error('Error dispatching admin alert email:', err);
    }

    res.status(201).json({ booking, emailNotification });
  } catch (err) {
    next(err);
  }
});

// Client confirms or declines a proposed option
app.post('/api/bookings/confirm-option', async (req, res) => {
  const studio = loadStudio();
  const { reference, date, time, action } = req.body || {};
  const booking = (studio.bookings || []).find((b) => b.reference === reference || b.id === reference);

  if (!booking) {
    return res.status(404).json({ error: 'Rendez-vous introuvable.' });
  }

  const adminRecipient = studio.config.contactEmail || 'alshanasglow@gmail.com';

  if (action === 'accept' && date && time) {
    booking.status = 'confirmed';
    booking.preferredDate = date;
    booking.preferredTime = time;
    booking.adminDecisionNote = `Option validée directement par la cliente pour le ${formatDateFr(date)} à ${time}.`;
    saveStudio(studio);
    BookingModel.findOneAndUpdate({ id: booking.id }, booking, { upsert: true }).catch(() => {});

    // 1. Email to Admin
    try {
      await dispatchEmail(studio, {
        to: adminRecipient,
        replyTo: booking.clientEmail,
        subject: `[${studio.config.brandName}] Option validée par la cliente (${booking.reference}) — ${booking.clientName}`,
        text: `La cliente ${booking.clientName} a validé son créneau pour le ${formatDateFr(date)} à ${time}.\nPrestation : ${booking.serviceName}\nVoir l’administration : ${SITE_URL}/admin`,
        html: createEmailHtml({
          studio,
          statusBadge: `Créneau validé · ${booking.reference}`,
          title: `Choix confirmé par ${booking.clientName}`,
          subtitle: `La cliente a validé son rendez-vous parmi les options proposées.`,
          rows: [
            ['Référence', booking.reference],
            ['Cliente', booking.clientName],
            ['Téléphone', booking.clientPhone],
            ['E-mail', booking.clientEmail],
            ['Prestation', booking.serviceName],
            ['Date confirmée', formatDateFr(date)],
            ['Heure confirmée', time],
          ],
          totalLabel: 'Tarif estimé',
          totalValue: `${booking.totalPrice} €`,
          noteTitle: 'Statut du planning',
          noteBody: 'Ce créneau est désormais validé et synchronisé dans votre calendrier.',
          ctaLabel: 'Ouvrir l’administration',
          ctaUrl: `${SITE_URL}/admin`,
        }),
        kind: 'admin_alert',
      });
    } catch (err) {
      console.error('Error alerting admin on option accept:', err);
    }

    // 2. Confirmation Email to Client with full address
    try {
      await dispatchEmail(studio, {
        to: booking.clientEmail,
        replyTo: adminRecipient,
        subject: `[${studio.config.brandName}] Votre rendez-vous est confirmé — ${formatDateFr(date)} à ${time}`,
        text: `Bonjour ${booking.clientName},\nVotre rendez-vous pour ${booking.serviceName} est validé pour le ${formatDateFr(date)} à ${time} au ${studio.config.exactStudioAddress || '2 rue du Général Gallieni, 85000 La Roche-sur-Yon'}.\nÀ très vite au studio !`,
        html: createEmailHtml({
          studio,
          statusBadge: `Rendez-vous validé · ${booking.reference}`,
          title: 'Votre rendez-vous est confirmé',
          subtitle: `Bonjour ${booking.clientName}, votre choix a bien été enregistré avec succès chez ${studio.config.brandName}.`,
          rows: [
            ['Référence', booking.reference],
            ['Prestation', `${booking.serviceName} (${booking.variantLabel})`],
            ['Date confirmée', formatDateFr(date)],
            ['Heure confirmée', time],
            ['Lieu du rendez-vous', studio.config.exactStudioAddress || '2 rue du Général Gallieni, 85000 La Roche-sur-Yon'],
          ],
          totalLabel: 'Tarif estimé',
          totalValue: `${booking.totalPrice} €`,
          totalNote: 'Règlement au studio',
          noteTitle: 'Adresse exacte & consignes',
          noteBody: `Le studio se situe au ${studio.config.exactStudioAddress || '2 rue du Général Gallieni, 85000 La Roche-sur-Yon'}. Merci de venir sans maquillage pour optimiser la pose.`,
          ctaLabel: 'Consulter le site en ligne',
          ctaUrl: SITE_URL,
          footer: `${studio.config.brandName} · ${studio.config.locationLine}`,
        }),
        kind: 'client_confirmed',
      });
    } catch (err) {
      console.error('Error confirming client on option accept:', err);
    }

    return res.json({ ok: true, status: 'confirmed', booking });
  }

  if (action === 'decline') {
    booking.status = 'cancelled';
    booking.adminDecisionNote = 'Créneaux proposés refusés par la cliente.';
    saveStudio(studio);
    BookingModel.findOneAndUpdate({ id: booking.id }, booking, { upsert: true }).catch(() => {});

    // Email to Admin
    try {
      await dispatchEmail(studio, {
        to: adminRecipient,
        replyTo: booking.clientEmail,
        subject: `[${studio.config.brandName}] Créneaux déclinés par la cliente (${booking.reference}) — ${booking.clientName}`,
        text: `La cliente ${booking.clientName} n'était pas disponible pour les options proposées pour ${booking.serviceName}.\nConsulter la fiche : ${SITE_URL}/admin`,
        html: createEmailHtml({
          studio,
          statusBadge: `Créneaux déclinés · ${booking.reference}`,
          title: `Réponse de ${booking.clientName}`,
          subtitle: `La cliente n’était pas disponible pour les dates proposées.`,
          rows: [
            ['Référence', booking.reference],
            ['Cliente', booking.clientName],
            ['Téléphone', booking.clientPhone],
            ['E-mail', booking.clientEmail],
            ['Prestation', booking.serviceName],
          ],
          noteTitle: 'Information studio',
          noteBody: 'Vous pouvez proposer d’autres créneaux ou échanger directement par téléphone ou Instagram.',
          ctaLabel: 'Gérer dans l’administration',
          ctaUrl: `${SITE_URL}/admin`,
        }),
        kind: 'admin_alert',
      });
    } catch (err) {
      console.error('Error alerting admin on option decline:', err);
    }

    return res.json({ ok: true, status: 'cancelled', booking });
  }

  res.status(400).json({ error: 'Action invalide.' });
});

app.post('/api/admin/bookings/:id/propose-slots', requireAdmin, async (req, res) => {
  const studio = loadStudio();
  const { id } = req.params;
  const booking = (studio.bookings || []).find((b) => b.id === id);
  if (!booking) {
    return res.status(404).json({ error: 'Rendez-vous introuvable.' });
  }

  const slots = Array.isArray(req.body?.slots) ? req.body.slots : [];
  if (slots.length === 0) {
    return res.status(400).json({ error: 'Veuillez renseigner au moins une option de créneau.' });
  }

  const optionsList = slots.map((s, idx) => {
    const formatted = `${formatDateFr(s.date)} à ${s.time}`;
    const url = `${SITE_URL}/confirmation-option?ref=${booking.reference}&date=${encodeURIComponent(s.date)}&time=${encodeURIComponent(s.time)}`;
    return { label: formatted, url };
  });

  const subject = `[${studio.config.brandName}] Choix de créneau pour votre soin (${booking.reference})`;
  const text = `Bonjour ${booking.clientName},\nLe créneau initialement demandé n'est plus libre. Voici les créneaux alternatifs disponibles :\n${slots.map((s, i) => `Option ${i + 1} : ${formatDateFr(s.date)} à ${s.time} -> ${SITE_URL}/confirmation-option?ref=${booking.reference}&date=${s.date}&time=${s.time}`).join('\n')}\n\nCliquez sur le lien de votre choix pour valider votre rendez-vous.`;

  const html = createEmailHtml({
    studio,
    statusBadge: `Choix de créneau · ${booking.reference}`,
    title: 'Créneaux disponibles au choix',
    subtitle: `Bonjour ${booking.clientName}, le créneau initialement demandé est déjà réservé. Voici les alternatives disponibles pour votre séance chez ${studio.config.brandName} :`,
    rows: [
      ['Référence', booking.reference],
      ['Prestation', `${booking.serviceName} (${booking.variantLabel})`],
    ],
    optionsList,
    totalLabel: 'Tarif estimé',
    totalValue: `${booking.totalPrice} €`,
    noteTitle: 'Validation en 1 clic',
    noteBody: 'Cliquez simplement sur l’option qui vous convient ci-dessus pour confirmer immédiatement votre réservation.',
    ctaLabel: 'Consulter le planning en ligne',
    ctaUrl: `${SITE_URL}/reserver`,
    footer: `${studio.config.brandName} · ${studio.config.locationLine}`,
  });

  let emailNotification = null;
  try {
    emailNotification = await dispatchEmail(studio, {
      to: booking.clientEmail,
      replyTo: studio.config.contactEmail,
      subject,
      text,
      html,
      kind: 'client_options',
    });
  } catch (err) {
    console.error('Error dispatching slots email:', err);
  }

  booking.adminDecisionNote = `Propositions envoyées : ${slots.map((s, i) => `Option ${i + 1} (${formatDateFr(s.date)} à ${s.time})`).join(', ')}`;
  writeJsonSafe(STUDIO_FILE, studio);

  res.json({ ok: true, emailNotification, booking, studio: buildAdminStudio(studio) });
});

app.post('/api/admin/login', (req, res) => {
  const studio = loadStudio();
  const secrets = loadEmailSecrets();
  const passcode = String(req.body?.passcode || '');
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (email && email !== (studio.config.contactEmail || '').toLowerCase()) {
    return res.status(401).json({ error: 'Adresse e-mail administrateur non reconnue.' });
  }
  if (passcode !== studio.config.adminPasscode) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }
  const token = issueToken(secrets.tokenSecret);
  res.json({ token, studio: buildAdminStudio(studio) });
});

app.get('/api/admin/studio', requireAdmin, (_req, res) => {
  const studio = loadStudio();
  res.json(buildAdminStudio(studio));
});

app.put('/api/admin/studio', requireAdmin, (req, res) => {
  const studio = loadStudio();
  const body = req.body || {};

  if (body.config) {
    const incomingPasscode = body.config.adminPasscode?.trim();
    studio.config = {
      ...studio.config,
      ...body.config,
      adminPasscode: incomingPasscode ? incomingPasscode : studio.config.adminPasscode,
      cloudinary: {
        ...studio.config.cloudinary,
        ...(body.config.cloudinary || {}),
      },
      bookingRules: {
        ...studio.config.bookingRules,
        ...(body.config.bookingRules || {}),
      },
    };
  }
  if (Array.isArray(body.services)) studio.services = body.services;
  if (Array.isArray(body.addons)) studio.addons = body.addons;
  if (Array.isArray(body.protocols)) studio.protocols = body.protocols;
  if (Array.isArray(body.media)) studio.media = body.media;
  if (Array.isArray(body.bookings)) studio.bookings = body.bookings;

  writeJsonSafe(STUDIO_FILE, studio);
  res.json(buildAdminStudio(studio));
});

app.patch('/api/admin/bookings/:id', requireAdmin, async (req, res) => {
  const studio = loadStudio();
  const { id } = req.params;
  const idx = (studio.bookings || []).findIndex((b) => b.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Rendez-vous introuvable.' });
  }

  const existing = studio.bookings[idx];
  const nextStatus = req.body?.status || existing.status;
  const nextDate = req.body?.preferredDate || existing.preferredDate;
  const nextTime = req.body?.preferredTime || existing.preferredTime;
  const adminDecisionNote =
    req.body?.adminDecisionNote !== undefined
      ? String(req.body.adminDecisionNote).trim()
      : existing.adminDecisionNote;

  if (nextStatus === 'confirmed') {
    const conflict = studio.bookings.find(
      (b) =>
        b.id !== id &&
        b.status === 'confirmed' &&
        b.preferredDate === nextDate &&
        b.preferredTime === nextTime
    );
    if (conflict) {
      return res.status(409).json({
        error: `Le créneau du ${formatDateFr(nextDate)} à ${nextTime} est déjà confirmé pour ${conflict.clientName}.`,
      });
    }
  }

  const sup = evaluateSupplement(nextDate, nextTime, studio.config.bookingRules);
  const updated = {
    ...existing,
    status: nextStatus,
    preferredDate: nextDate,
    preferredTime: nextTime,
    isSupplementApplied: sup.applied,
    supplementReason: sup.reason || undefined,
    supplementPrice: sup.amount,
    totalPrice: Number(existing.basePrice) + Number(existing.addonsPrice || 0) + sup.amount,
    adminDecisionNote: adminDecisionNote || undefined,
  };

  studio.bookings[idx] = updated;
  saveStudio(studio);
  BookingModel.findOneAndUpdate({ id: updated.id }, updated, { upsert: true }).catch(() => {});

  let emailNotification = null;

  if (nextStatus === 'confirmed' && updated.clientEmail) {
    const subject = `[${studio.config.brandName}] Rendez-vous confirmé — ${formatDateFr(updated.preferredDate)} à ${updated.preferredTime}`;
    const text = [
      `Bonjour ${updated.clientName},`,
      ``,
      `Votre rendez-vous chez ${studio.config.brandName} est validé.`,
      `Référence : ${updated.reference}`,
      `Prestation : ${updated.serviceName} (${updated.variantLabel})`,
      updated.addonNames.length > 0 ? `Options : ${updated.addonNames.join(', ')}` : null,
      `Date confirmée : ${formatDateFr(updated.preferredDate)}`,
      `Heure confirmée : ${updated.preferredTime}`,
      `Tarif estimé : ${updated.totalPrice} €${updated.isSupplementApplied ? ` (inclut +${updated.supplementPrice} € : ${updated.supplementReason})` : ''}`,
      `Lieu exact : ${studio.config.exactStudioAddress || '2 rue du Général Gallieni, 85000 La Roche-sur-Yon'}`,
      adminDecisionNote ? `Mot du studio : ${adminDecisionNote}` : null,
      ``,
      `Pour toute question ou réajustement, contactez-nous sur Instagram : ${studio.config.handle} (${studio.config.instagramUrl})`,
    ]
      .filter(Boolean)
      .join('\n');

    const html = createEmailHtml({
      studio,
      statusBadge: `Rendez-vous validé · ${updated.reference}`,
      title: 'Votre rendez-vous est confirmé',
      subtitle: `Bonjour ${updated.clientName}, votre demande de créneau chez ${studio.config.brandName} vient d’être validée.`,
      rows: [
        ['Référence', updated.reference],
        ['Prestation', `${updated.serviceName} (${updated.variantLabel})`],
        ['Options', updated.addonNames.length > 0 ? updated.addonNames.join(', ') : 'Aucune'],
        ['Date confirmée', formatDateFr(updated.preferredDate)],
        ['Heure confirmée', updated.preferredTime],
        ['Lieu du rendez-vous', studio.config.exactStudioAddress || '2 rue du Général Gallieni, 85000 La Roche-sur-Yon'],
      ],
      totalLabel: 'Tarif estimé',
      totalValue: `${updated.totalPrice} €`,
      totalNote: updated.isSupplementApplied
        ? `Inclut +${updated.supplementPrice} € (${updated.supplementReason})`
        : 'Règlement au studio',
      noteTitle: adminDecisionNote ? 'Mot du studio' : 'Adresse exacte & consignes',
      noteBody:
        adminDecisionNote ||
        `Le studio se situe au ${studio.config.exactStudioAddress || '2 rue du Général Gallieni, 85000 La Roche-sur-Yon'}. Merci de vous présenter sans maquillage pour optimiser la pose.`,
      ctaLabel: `Voir ${studio.config.handle} sur Instagram`,
      ctaUrl: studio.config.instagramUrl,
      footer: `${studio.config.brandName} · ${studio.config.locationLine}`,
    });

    emailNotification = await dispatchEmail(studio, {
      to: updated.clientEmail,
      replyTo: studio.config.contactEmail,
      subject,
      text,
      html,
      kind: 'client_confirmed',
    });
  } else if (nextStatus === 'cancelled' && updated.clientEmail) {
    const subject = `[${studio.config.brandName}] Mise à jour de votre demande (${updated.reference})`;
    const text = [
      `Bonjour ${updated.clientName},`,
      ``,
      `Le créneau demandé le ${formatDateFr(updated.preferredDate)} à ${updated.preferredTime} pour ${updated.serviceName} n’a pas pu être maintenu.`,
      adminDecisionNote ? `Précision du studio : ${adminDecisionNote}` : null,
      ``,
      `Vous pouvez choisir un autre créneau sur le site ou nous écrire directement sur Instagram : ${studio.config.handle} (${studio.config.instagramUrl})`,
    ]
      .filter(Boolean)
      .join('\n');

    const html = createEmailHtml({
      studio,
      statusBadge: `Mise à jour · ${updated.reference}`,
      title: 'Créneau indisponible',
      subtitle: `Bonjour ${updated.clientName}, le créneau du ${formatDateFr(updated.preferredDate)} à ${updated.preferredTime} n’a pas pu être maintenu.`,
      rows: [
        ['Référence', updated.reference],
        ['Prestation', `${updated.serviceName} (${updated.variantLabel})`],
        ['Créneau demandé', `${formatDateFr(updated.preferredDate)} à ${updated.preferredTime}`],
      ],
      noteTitle: adminDecisionNote ? 'Précision du studio' : 'Nouvelle disponibilité',
      noteBody:
        adminDecisionNote ||
        `Nous vous invitons à choisir un nouvel horaire en ligne ou à nous écrire directement sur Instagram (${studio.config.handle}).`,
      ctaLabel: `Contacter ${studio.config.handle}`,
      ctaUrl: studio.config.instagramUrl,
      footer: `${studio.config.brandName} · ${studio.config.locationLine}`,
    });

    emailNotification = await dispatchEmail(studio, {
      to: updated.clientEmail,
      replyTo: studio.config.contactEmail,
      subject,
      text,
      html,
      kind: 'client_declined',
    });
  }

  res.json({ booking: updated, emailNotification, studio: buildAdminStudio(studio) });
});

app.delete('/api/admin/bookings/:id', requireAdmin, (req, res) => {
  const studio = loadStudio();
  studio.bookings = (studio.bookings || []).filter((b) => b.id !== req.params.id);
  saveStudio(studio);
  BookingModel.deleteOne({ id: req.params.id }).catch(() => {});
  res.json({ studio: buildAdminStudio(studio) });
});

// Configure Resend API or Gmail SMTP
app.post('/api/admin/email-provider', requireAdmin, async (req, res) => {
  const current = readJsonSafe(SECRETS_FILE, {
    provider: '',
    resendApiKey: '',
    resendFrom: "Alshana's Glow <onboarding@resend.dev>",
    gmailUser: '',
    gmailAppPassword: '',
    tokenSecret: loadEmailSecrets().tokenSecret,
  });

  const provider = String(req.body?.provider || current.provider || 'resend');
  const resendApiKey = String(req.body?.resendApiKey || '').trim() || current.resendApiKey;
  const resendFrom =
    String(req.body?.resendFrom || '').trim() ||
    current.resendFrom ||
    "Alshana's Glow <onboarding@resend.dev>";
  const gmailUser = String(req.body?.gmailUser || '').trim() || current.gmailUser;
  const gmailAppPassword =
    String(req.body?.gmailAppPassword || '').replace(/\s+/g, '') || current.gmailAppPassword;

  const next = {
    ...current,
    provider,
    resendApiKey,
    resendFrom,
    gmailUser,
    gmailAppPassword,
  };

  if (provider === 'resend') {
    if (!next.resendApiKey) {
      return res.status(400).json({ error: 'Renseignez votre clé API Resend (re_...).' });
    }
    // Verify key against Resend domains endpoint
    try {
      const check = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${next.resendApiKey}` },
      });
      if (!check.ok) {
        const errJson = await check.json().catch(() => null);
        return res.status(400).json({
          error: errJson?.message || `Clé Resend refusée (${check.status}).`,
        });
      }
      writeJsonSafe(SECRETS_FILE, next);
      const studio = loadStudio();
      return res.json({
        verified: true,
        message: 'Configuration Resend enregistrée et vérifiée.',
        studio: buildAdminStudio(studio),
      });
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Erreur de vérification Resend.',
      });
    }
  }

  if (provider === 'gmail') {
    if (!next.gmailUser || !next.gmailAppPassword) {
      return res.status(400).json({
        error: 'Renseignez votre adresse Gmail et le mot de passe d’application Google (16 caractères).',
      });
    }
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: next.gmailUser, pass: next.gmailAppPassword },
      });
      await transporter.verify();
      writeJsonSafe(SECRETS_FILE, next);
      const studio = loadStudio();
      return res.json({
        verified: true,
        message: `Connexion Gmail SMTP validée pour ${next.gmailUser}.`,
        studio: buildAdminStudio(studio),
      });
    } catch (err) {
      return res.status(400).json({
        error:
          err instanceof Error
            ? `Échec d’authentification Gmail : ${err.message}`
            : 'Impossible de vérifier les identifiants Gmail.',
      });
    }
  }

  writeJsonSafe(SECRETS_FILE, next);
  const studio = loadStudio();
  res.json({ verified: true, message: 'Paramètres mis à jour.', studio: buildAdminStudio(studio) });
});

app.post('/api/admin/test-email', requireAdmin, async (req, res) => {
  const studio = loadStudio();
  const toEmail = String(req.body?.toEmail || studio.config.contactEmail || '').trim();
  const roleLabel = String(req.body?.roleLabel || 'Administrateur').trim();

  const result = await dispatchEmail(studio, {
    to: toEmail,
    subject: `[${studio.config.brandName}] Test de réception E-mail (${roleLabel})`,
    text: `Ce message confirme que l’envoi d’e-mails fonctionne pour le rôle ${roleLabel} (${toEmail}).`,
    html: createEmailHtml({
      studio,
      statusBadge: `Test E-mail · ${roleLabel}`,
      title: `Réception confirmée (${roleLabel})`,
      subtitle: `Cet e-mail reprend à l’identique la charte éditoriale ${studio.config.brandName} et valide la livraison Resend / Gmail sur cette adresse.`,
      rows: [
        ['Rôle testé', roleLabel],
        ['Destinataire', toEmail],
        ['Expéditeur', studio.config.brandName],
        ['Date du test', new Date().toLocaleString('fr-FR')],
      ],
      totalLabel: 'Exemple tarif carte',
      totalValue: '40 €',
      totalNote: 'Cil à cil · Pose complète (+10 € après 19h / dimanche / férié)',
      noteTitle: 'Charte graphique appliquée',
      noteBody:
        'Logo des yeux en en-tête sombre et carte blanche éditoriale identique à la carte des prestations du site, sans aucun émoji.',
      ctaLabel: `Ouvrir ${studio.config.handle}`,
      ctaUrl: studio.config.instagramUrl,
      footer: `${studio.config.brandName} · ${studio.config.locationLine}`,
    }),
    kind: 'test',
  });

  res.json({ result, studio: buildAdminStudio(studio) });
});

app.post('/api/admin/reset', requireAdmin, (_req, res) => {
  const seeded = structuredClone(DEFAULT_SERVER_STUDIO);
  saveStudio(seeded);
  res.json({ studio: buildAdminStudio(seeded) });
});

// Express error handling middleware
app.use((err, _req, res, _next) => {
  console.error('[API Server Error]:', err);
  res.status(500).json({
    error: err?.message || 'Erreur interne du serveur',
    stack: err?.stack,
  });
});

const PORT = Number(process.env.PORT || 3001);
if (!process.env.VERCEL) {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[alshanas-glow-api] listening on http://127.0.0.1:${PORT}`);
  });
}

export default app;
