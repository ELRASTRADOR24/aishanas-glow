import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_STUDIO_DATA } from '../data/defaultStudioData';
import type {
  BookingRequest,
  BookingStatus,
  BookingVariant,
  MediaAsset,
  ProtocolBlock,
  ServiceAddon,
  ServiceItem,
  StudioConfig,
  StudioData,
} from '../types/studio';
import type { ServerEmailNotification } from '../utils/emailDispatch';

const TOKEN_STORAGE_KEY = 'alshana_admin_token_v2';

export interface SubmitBookingPayload {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientInstagram: string;
  serviceId: string;
  variant: BookingVariant;
  addonIds: string[];
  preferredDate: string;
  preferredTime: string;
  contraindicationsConfirmed: boolean;
  notes?: string;
}

export interface SubmitBookingResponse {
  booking: BookingRequest;
  emailNotification: ServerEmailNotification;
}

export interface UpdateBookingDecisionPayload {
  status: BookingStatus;
  preferredDate?: string;
  preferredTime?: string;
  adminDecisionNote?: string;
}

interface StudioContextValue {
  data: StudioData;
  loading: boolean;
  adminToken: string | null;
  refreshPublicStudio: () => Promise<void>;
  refreshAdminStudio: (tokenOverride?: string) => Promise<void>;
  loginAdmin: (passcode: string, email?: string) => Promise<void>;
  logoutAdmin: () => void;
  submitBooking: (payload: SubmitBookingPayload) => Promise<SubmitBookingResponse>;
  updateConfig: (partial: Partial<StudioConfig>) => Promise<void>;
  upsertService: (service: ServiceItem) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  upsertAddon: (addon: ServiceAddon) => Promise<void>;
  deleteAddon: (id: string) => Promise<void>;
  upsertProtocol: (protocol: ProtocolBlock) => Promise<void>;
  deleteProtocol: (id: string) => Promise<void>;
  addMediaAsset: (asset: MediaAsset) => Promise<void>;
  deleteMediaAsset: (id: string) => Promise<void>;
  updateBookingDecision: (
    id: string,
    payload: UpdateBookingDecisionPayload
  ) => Promise<{ booking: BookingRequest; emailNotification: ServerEmailNotification | null }>;
  deleteBooking: (id: string) => Promise<void>;
  saveEmailProviderSettings: (payload: {
    provider: 'resend' | 'gmail';
    resendApiKey?: string;
    resendFrom?: string;
    gmailUser?: string;
    gmailAppPassword?: string;
  }) => Promise<string>;
  sendTestEmail: (toEmail: string, roleLabel: string) => Promise<ServerEmailNotification>;
  importStudioData: (rawJson: string) => Promise<void>;
  resetStudioData: () => Promise<void>;
}

const StudioContext = createContext<StudioContextValue | null>(null);

function normalizeStudio(raw: Partial<StudioData> | null | undefined): StudioData {
  if (!raw) return DEFAULT_STUDIO_DATA;
  return {
    config: {
      ...DEFAULT_STUDIO_DATA.config,
      ...(raw.config ?? {}),
      showServiceImages: raw.config?.showServiceImages ?? true,
      cloudinary: {
        ...DEFAULT_STUDIO_DATA.config.cloudinary,
        ...(raw.config?.cloudinary ?? {}),
      },
      bookingRules: {
        ...DEFAULT_STUDIO_DATA.config.bookingRules,
        ...(raw.config?.bookingRules ?? {}),
        flexibleHours: raw.config?.bookingRules?.flexibleHours ?? true,
        closedWeekdays: raw.config?.bookingRules?.closedWeekdays ?? [],
        blockedDates: raw.config?.bookingRules?.blockedDates ?? [],
        blockedSlots: raw.config?.bookingRules?.blockedSlots ?? [],
      },
    },
    services: (raw.services ?? DEFAULT_STUDIO_DATA.services).map((s) => ({
      ...s,
      showImage: s.showImage ?? true,
    })),
    addons: raw.addons ?? DEFAULT_STUDIO_DATA.addons,
    protocols: raw.protocols ?? DEFAULT_STUDIO_DATA.protocols,
    media: raw.media ?? DEFAULT_STUDIO_DATA.media,
    bookings: raw.bookings ?? [],
    occupiedSlots: raw.occupiedSlots ?? [],
    emailLogs: raw.emailLogs ?? [],
    smtpStatus: raw.smtpStatus ?? {
      configured: false,
      provider: 'none',
      gmailUser: '',
      resendFrom: "Alshana's Glow <onboarding@resend.dev>",
      hasResendKey: false,
    },
  };
}

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<StudioData>(DEFAULT_STUDIO_DATA);
  const [loading, setLoading] = useState(true);
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  });
  const saveSeqRef = useRef(0);

  const refreshPublicStudio = useCallback(async () => {
    try {
      const res = await fetch('/api/studio');
      if (res.ok) {
        const json = (await res.json()) as Partial<StudioData>;
        setData(normalizeStudio(json));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAdminStudio = useCallback(
    async (tokenOverride?: string) => {
      const token = tokenOverride || adminToken;
      if (!token) return;
      const res = await fetch('/api/admin/studio', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        setAdminToken(null);
        return;
      }
      if (res.ok) {
        const json = (await res.json()) as Partial<StudioData>;
        setData(normalizeStudio(json));
      }
    },
    [adminToken]
  );

  useEffect(() => {
    if (adminToken) {
      refreshAdminStudio(adminToken).finally(() => setLoading(false));
    } else {
      refreshPublicStudio();
    }
  }, [adminToken, refreshAdminStudio, refreshPublicStudio]);

  const persistAdminUpdate = async (nextData: StudioData) => {
    const seq = ++saveSeqRef.current;
    setData(nextData);
    if (!adminToken) return;
    const res = await fetch('/api/admin/studio', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        config: nextData.config,
        services: nextData.services,
        addons: nextData.addons,
        protocols: nextData.protocols,
        media: nextData.media,
        bookings: nextData.bookings,
      }),
    });
    if (res.ok && seq === saveSeqRef.current) {
      const saved = (await res.json()) as Partial<StudioData>;
      setData(normalizeStudio(saved));
    }
  };

  const loginAdmin = async (passcode: string, email?: string) => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode, email }),
    });
    const payload = (await res.json().catch(() => null)) as {
      token?: string;
      studio?: Partial<StudioData>;
      error?: string;
    } | null;
    if (!res.ok || !payload?.token) {
      throw new Error(payload?.error || 'Code d’accès incorrect.');
    }
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
    setAdminToken(payload.token);
    if (payload.studio) {
      setData(normalizeStudio(payload.studio));
    }
  };

  const logoutAdmin = () => {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setAdminToken(null);
    refreshPublicStudio();
  };

  const submitBooking = async (payload: SubmitBookingPayload): Promise<SubmitBookingResponse> => {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => null)) as
      | (SubmitBookingResponse & { error?: string })
      | null;
    if (!res.ok || !body?.booking) {
      throw new Error(body?.error || 'Impossible d’enregistrer la demande.');
    }
    if (adminToken) {
      await refreshAdminStudio(adminToken);
    } else {
      await refreshPublicStudio();
    }
    return {
      booking: body.booking,
      emailNotification: body.emailNotification,
    };
  };

  const updateConfig = async (partial: Partial<StudioConfig>) => {
    const next: StudioData = {
      ...data,
      config: {
        ...data.config,
        ...partial,
        cloudinary: partial.cloudinary
          ? { ...data.config.cloudinary, ...partial.cloudinary }
          : data.config.cloudinary,
        bookingRules: partial.bookingRules
          ? { ...data.config.bookingRules, ...partial.bookingRules }
          : data.config.bookingRules,
      },
    };
    await persistAdminUpdate(next);
  };

  const upsertService = async (service: ServiceItem) => {
    const exists = data.services.some((s) => s.id === service.id);
    const next: StudioData = {
      ...data,
      services: exists
        ? data.services.map((s) => (s.id === service.id ? service : s))
        : [...data.services, service],
    };
    await persistAdminUpdate(next);
  };

  const deleteService = async (id: string) => {
    const next: StudioData = {
      ...data,
      services: data.services.filter((s) => s.id !== id),
    };
    await persistAdminUpdate(next);
  };

  const upsertAddon = async (addon: ServiceAddon) => {
    const exists = data.addons.some((a) => a.id === addon.id);
    const next: StudioData = {
      ...data,
      addons: exists
        ? data.addons.map((a) => (a.id === addon.id ? addon : a))
        : [...data.addons, addon],
    };
    await persistAdminUpdate(next);
  };

  const deleteAddon = async (id: string) => {
    const next: StudioData = {
      ...data,
      addons: data.addons.filter((a) => a.id !== id),
    };
    await persistAdminUpdate(next);
  };

  const upsertProtocol = async (protocol: ProtocolBlock) => {
    const exists = data.protocols.some((p) => p.id === protocol.id);
    const next: StudioData = {
      ...data,
      protocols: exists
        ? data.protocols.map((p) => (p.id === protocol.id ? protocol : p))
        : [...data.protocols, protocol],
    };
    await persistAdminUpdate(next);
  };

  const deleteProtocol = async (id: string) => {
    const next: StudioData = {
      ...data,
      protocols: data.protocols.filter((p) => p.id !== id),
    };
    await persistAdminUpdate(next);
  };

  const addMediaAsset = async (asset: MediaAsset) => {
    const next: StudioData = {
      ...data,
      media: [asset, ...data.media],
    };
    await persistAdminUpdate(next);
  };

  const deleteMediaAsset = async (id: string) => {
    const next: StudioData = {
      ...data,
      media: data.media.filter((m) => m.id !== id),
    };
    await persistAdminUpdate(next);
  };

  const updateBookingDecision = async (
    id: string,
    payload: UpdateBookingDecisionPayload
  ) => {
    if (!adminToken) throw new Error('Non authentifié.');
    const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => null)) as {
      booking?: BookingRequest;
      emailNotification?: ServerEmailNotification | null;
      studio?: Partial<StudioData>;
      error?: string;
    } | null;
    if (!res.ok || !body?.booking) {
      throw new Error(body?.error || 'Impossible de mettre à jour ce rendez-vous.');
    }
    if (body.studio) {
      setData(normalizeStudio(body.studio));
    }
    return {
      booking: body.booking,
      emailNotification: body.emailNotification ?? null,
    };
  };

  const deleteBooking = async (id: string) => {
    if (!adminToken) return;
    const res = await fetch(`/api/admin/bookings/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.ok) {
      const body = (await res.json()) as { studio?: Partial<StudioData> };
      if (body.studio) setData(normalizeStudio(body.studio));
    }
  };

  const saveEmailProviderSettings = async (payload: {
    provider: 'resend' | 'gmail';
    resendApiKey?: string;
    resendFrom?: string;
    gmailUser?: string;
    gmailAppPassword?: string;
  }) => {
    if (!adminToken) throw new Error('Non authentifié.');
    const res = await fetch('/api/admin/email-provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => null)) as {
      message?: string;
      studio?: Partial<StudioData>;
      error?: string;
    } | null;
    if (!res.ok) {
      throw new Error(body?.error || 'Échec de vérification de la configuration e-mail.');
    }
    if (body?.studio) setData(normalizeStudio(body.studio));
    return body?.message || 'Configuration e-mail enregistrée.';
  };

  const sendTestEmail = async (toEmail: string, roleLabel: string) => {
    if (!adminToken) throw new Error('Non authentifié.');
    const res = await fetch('/api/admin/test-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ toEmail, roleLabel }),
    });
    const body = (await res.json().catch(() => null)) as {
      result?: ServerEmailNotification;
      studio?: Partial<StudioData>;
      error?: string;
    } | null;
    if (!res.ok || !body?.result) {
      throw new Error(body?.error || 'Impossible d’envoyer le test.');
    }
    if (body.studio) setData(normalizeStudio(body.studio));
    return body.result;
  };

  const importStudioData = async (rawJson: string) => {
    const parsed = JSON.parse(rawJson) as StudioData;
    if (!parsed || !parsed.config || !Array.isArray(parsed.services)) {
      throw new Error('Structure JSON invalide pour Alshana’s Glow.');
    }
    await persistAdminUpdate(normalizeStudio(parsed));
  };

  const resetStudioData = async () => {
    if (!adminToken) return;
    const res = await fetch('/api/admin/reset', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.ok) {
      const body = (await res.json()) as { studio?: Partial<StudioData> };
      if (body.studio) setData(normalizeStudio(body.studio));
    }
  };

  return (
    <StudioContext.Provider
      value={{
        data,
        loading,
        adminToken,
        refreshPublicStudio,
        refreshAdminStudio,
        loginAdmin,
        logoutAdmin,
        submitBooking,
        updateConfig,
        upsertService,
        deleteService,
        upsertAddon,
        deleteAddon,
        upsertProtocol,
        deleteProtocol,
        addMediaAsset,
        deleteMediaAsset,
        updateBookingDecision,
        deleteBooking,
        saveEmailProviderSettings,
        sendTestEmail,
        importStudioData,
        resetStudioData,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
};

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) {
    throw new Error('useStudio doit être utilisé à l’intérieur de StudioProvider');
  }
  return ctx;
}
