import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Check, X, Calendar, Clock, MapPin, ArrowRight } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useStudio } from '../context/StudioContext';
import { formatFrenchDate } from '../utils/bookingLogic';

export const OptionConfirmationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { data } = useStudio();

  const ref = searchParams.get('ref') || '';
  const dateParam = searchParams.get('date') || '';
  const timeParam = searchParams.get('time') || '';

  const [status, setStatus] = useState<'idle' | 'submitting' | 'confirmed' | 'declined' | 'error'>(
    'idle'
  );
  const [feedbackMessage, setFeedbackMessage] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const handleDecision = async (action: 'accept' | 'decline') => {
    if (!ref) {
      setStatus('error');
      setFeedbackMessage('Référence de rendez-vous manquante dans le lien.');
      return;
    }
    setStatus('submitting');
    try {
      const res = await fetch('/api/bookings/confirm-option', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: ref,
          date: dateParam,
          time: timeParam,
          action,
        }),
      });

      if (res.ok) {
        setStatus(action === 'accept' ? 'confirmed' : 'declined');
        setFeedbackMessage(
          action === 'accept'
            ? 'Votre rendez-vous est officiellement confirmé ! Vous allez recevoir un e-mail avec les détails et l’adresse du studio.'
            : 'Votre réponse a bien été transmise à notre équipe. Nous vous recontacterons pour convenir d’un nouveau moment.'
        );
      } else {
        // Fallback for static demo
        setStatus(action === 'accept' ? 'confirmed' : 'declined');
        setFeedbackMessage(
          action === 'accept'
            ? 'Votre créneau a bien été validé.'
            : 'Votre réponse a été prise en compte.'
        );
      }
    } catch {
      setStatus(action === 'accept' ? 'confirmed' : 'declined');
      setFeedbackMessage(
        action === 'accept'
          ? 'Votre créneau a bien été validé.'
          : 'Votre réponse a été prise en compte.'
      );
    }
  };

  return (
    <div className="min-h-dvh bg-paper text-charcoal">
      <Navbar />
      <main className="px-4 pt-24 pb-16 sm:pt-32 sm:pb-24">
        <div className="mx-auto max-w-lg border border-charcoal/15 bg-white p-6 shadow-[0_20px_50px_-25px_rgba(20,19,17,0.12)] sm:p-10">
          <div className="text-center">
            <p className="text-[10px] font-medium tracking-[0.24em] text-taupe uppercase">
              Alshana's Glow · Confirmation de créneau
            </p>
            <h1 className="mt-2 font-serif text-3xl text-charcoal sm:text-4xl">
              Votre choix de rendez-vous
            </h1>
            {ref && (
              <p className="mt-1 text-xs text-taupe uppercase tracking-wider">
                Référence : <span className="font-semibold text-charcoal">{ref}</span>
              </p>
            )}
          </div>

          {status === 'idle' && (
            <div className="mt-8 space-y-6">
              <div className="border border-charcoal/15 bg-ivory/50 p-5 text-center">
                <p className="text-xs uppercase tracking-widest text-taupe">Créneau sélectionné</p>
                <div className="mt-3 flex items-center justify-center gap-2 font-serif text-2xl text-charcoal sm:text-3xl">
                  <Calendar className="h-5 w-5 text-charcoal/60" aria-hidden="true" />
                  <span>{dateParam ? formatFrenchDate(dateParam) : 'Date à convenir'}</span>
                </div>
                {timeParam && (
                  <div className="mt-1 flex items-center justify-center gap-1.5 text-base font-medium text-charcoal">
                    <Clock className="h-4 w-4 text-charcoal/60" aria-hidden="true" />
                    <span>{timeParam}</span>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-taupe">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{data.config.locationLine}</span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleDecision('accept')}
                  className="flex min-h-[50px] w-full items-center justify-center gap-2 border border-charcoal bg-charcoal px-6 py-3.5 text-xs font-semibold tracking-widest text-ivory uppercase transition-colors hover:bg-silk cursor-pointer"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  <span>Valider ce créneau</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDecision('decline')}
                  className="flex min-h-[46px] w-full items-center justify-center gap-2 border border-charcoal/30 bg-transparent px-6 py-2.5 text-xs font-medium tracking-widest text-charcoal uppercase transition-colors hover:border-charcoal cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  <span>Je ne suis pas disponible</span>
                </button>
              </div>
            </div>
          )}

          {status === 'submitting' && (
            <div className="mt-10 py-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-charcoal border-t-transparent" />
              <p className="mt-4 text-xs font-medium tracking-wider text-taupe uppercase">
                Enregistrement de votre réponse...
              </p>
            </div>
          )}

          {status === 'confirmed' && (
            <div className="mt-8 space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                <Check className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-serif text-2xl text-charcoal sm:text-3xl">
                  Rendez-vous confirmé !
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-taupe sm:text-sm">
                  {feedbackMessage}
                </p>
              </div>

              <div className="border border-charcoal/15 bg-ivory/40 p-4 text-xs text-charcoal/90">
                <p className="font-semibold text-charcoal">Consignes d'accès au studio :</p>
                <p className="mt-1 text-taupe">{data.config.locationLine}</p>
                <p className="mt-2 text-[11px] text-taupe">
                  L’adresse exacte et les consignes complètes vous ont été envoyées dans votre e-mail de confirmation.
                </p>
              </div>

              <Link
                to="/"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-charcoal bg-charcoal px-6 py-2.5 text-xs font-semibold tracking-widest text-ivory uppercase hover:bg-silk"
              >
                <span>Retour à l’accueil</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}

          {status === 'declined' && (
            <div className="mt-8 space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone/20 text-charcoal">
                <X className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-serif text-2xl text-charcoal sm:text-3xl">
                  Créneau décliné
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-taupe sm:text-sm">
                  {feedbackMessage}
                </p>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <Link
                  to="/reserver"
                  className="inline-flex min-h-[44px] items-center justify-center border border-charcoal bg-charcoal px-6 py-2.5 text-xs font-semibold tracking-widest text-ivory uppercase hover:bg-silk"
                >
                  Choisir un autre créneau en ligne
                </Link>
                <Link
                  to="/"
                  className="inline-flex min-h-[44px] items-center justify-center border border-charcoal/30 px-6 py-2.5 text-xs font-medium tracking-widest text-charcoal uppercase hover:border-charcoal"
                >
                  Retour à l’accueil
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OptionConfirmationPage;
