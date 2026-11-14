import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { DEFAULT_FAQS } from '../data/defaultStudioData';

export const FaqSection: React.FC = () => {
  const { data } = useStudio();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(['depose']));

  const activeFaqs = (data.faqs && data.faqs.length > 0 ? data.faqs : DEFAULT_FAQS).filter(
    (item) => item.active !== false
  );

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
            {data.config.faqCategoryBadge || 'Informations & Conseils'}
          </p>
          <h2 id="faq-heading" className="mt-2 font-serif text-3xl text-charcoal sm:text-4xl">
            {data.config.faqTitle || 'Questions fréquentes'}
          </h2>
          <p className="mt-2 text-xs text-taupe sm:text-sm">
            {data.config.faqSubtitle || 'Toutes les réponses pour préparer votre rendez-vous en toute sérénité.'}
          </p>
        </div>

        <div className="border border-charcoal/15 bg-white divide-y divide-charcoal/10">
          {activeFaqs.map((item) => {
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
