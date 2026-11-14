import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'depose',
    question: 'La dépose de cils est-elle gratuite ?',
    answer:
      'La dépose est 100% offerte si vous effectuez une nouvelle pose de cils au studio immédiatement après (option gratuite à cocher lors de votre réservation). La dépose seule sans nouvelle pose reste à 10 € pour un travail studio ou 15 € pour une pose extérieure.',
  },
  {
    id: 'remplissage',
    question: 'Quel est le délai pour un remplissage ?',
    answer:
      'Le tarif remplissage est valable jusqu’à 3 semaines maximum après votre pose. Au-delà de 3 semaines, une nouvelle pose complète est requise pour assurer la santé de vos cils naturels et un résultat impeccable.',
  },
  {
    id: 'supplement',
    question: 'Quels sont les créneaux avec supplément ?',
    answer:
      'Le studio applique un supplément de 5 € pour les créneaux en soirée (à partir de 18h00), ainsi que le dimanche et les jours fériés.',
  },
  {
    id: 'finitions',
    question: 'Peut-on demander des cils marrons ou des décos ?',
    answer:
      'Oui, les poses en cils marrons (effet très doux et naturel) ainsi que les finitions paillettes et décos sont disponibles. Il suffit de l’indiquer dans les précisions de votre réservation.',
  },
  {
    id: 'duree-pose',
    question: 'Combien de temps dure une prestation de cils ?',
    answer:
      'Chaque pose d’extensions de cils dure environ 2 heures pour garantir un travail soigné, précis cil par cil et une excellente tenue. Merci de venir sans maquillage des yeux pour optimiser la prise de la colle.',
  },
];

export const FaqSection: React.FC = () => {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(['depose']));

  const toggleItem = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="surface-paper scroll-mt-20 border-b border-stone/70 px-4 py-14 sm:px-6 sm:py-20"
    >
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-10">
          <p className="text-[11px] font-medium tracking-[0.24em] text-taupe uppercase">
            Informations &amp; Conseils
          </p>
          <h2 id="faq-heading" className="mt-2 font-serif text-3xl text-charcoal sm:text-4xl">
            Questions fréquentes
          </h2>
          <p className="mt-2 text-xs text-taupe sm:text-sm">
            Toutes les réponses pour préparer votre rendez-vous en toute sérénité.
          </p>
        </div>

        <div className="border border-charcoal/15 bg-white divide-y divide-charcoal/10">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openIds.has(item.id);
            return (
              <div key={item.id} className="transition-colors hover:bg-ivory/30">
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  aria-expanded={isOpen}
                  className="flex w-full min-h-[54px] items-center justify-between gap-4 p-5 text-left cursor-pointer"
                >
                  <span className="font-serif text-lg font-medium text-charcoal sm:text-xl">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-charcoal transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-taupe leading-relaxed font-light border-t border-charcoal/5 pt-3">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FaqSection;
