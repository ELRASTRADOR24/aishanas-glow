import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useStudio } from '../context/StudioContext';

export const ProtocolsSection: React.FC = () => {
  const { data } = useStudio();
  const [activeTab, setActiveTab] = useState<'rehaussement' | 'blanchiment'>('rehaussement');

  const rehaussementBlocks = data.protocols.filter((p) => p.group === 'rehaussement');
  const blanchimentBlocks = data.protocols.filter((p) => p.group === 'blanchiment');
  const visibleBlocks = activeTab === 'rehaussement' ? rehaussementBlocks : blanchimentBlocks;

  return (
    <section
      id="protocoles"
      aria-labelledby="protocoles-heading"
      className="surface-silk scroll-mt-20 border-b border-silk px-4 py-14 sm:px-6 sm:py-20"
    >
      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="text-center">
          <p className="text-[11px] font-medium tracking-[0.24em] text-stone uppercase">
            Informations & Précautions
          </p>
          <h2 id="protocoles-heading" className="mt-2 font-serif text-3xl text-ivory sm:text-5xl">
            Protocoles & Qualité des soins
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-stone/85 sm:text-sm">
            Tout ce qu’il faut connaître avant votre rendez-vous : composition des soins,
            contre-indications et consignes post-séance.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Choisir le protocole de soin"
          className="mx-auto mt-8 grid max-w-md grid-cols-2 border border-white/20 bg-black/30 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'rehaussement'}
            onClick={() => setActiveTab('rehaussement')}
            className={`min-h-[46px] px-4 py-2 text-xs font-medium tracking-[0.16em] uppercase transition-colors ${
              activeTab === 'rehaussement'
                ? 'bg-ivory text-obsidian'
                : 'text-stone hover:text-ivory'
            }`}
          >
            Rehaussement de cils
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'blanchiment'}
            onClick={() => setActiveTab('blanchiment')}
            className={`min-h-[46px] px-4 py-2 text-xs font-medium tracking-[0.16em] uppercase transition-colors ${
              activeTab === 'blanchiment'
                ? 'bg-ivory text-obsidian'
                : 'text-stone hover:text-ivory'
            }`}
          >
            Blanchiment dentaire
          </button>
        </div>

        <div className="mt-8 space-y-5">
          {visibleBlocks.map((block) => (
            <article
              key={block.id}
              className={`border p-6 sm:p-8 ${
                block.highlight
                  ? 'border-amber-200/40 bg-white/[0.06]'
                  : 'border-white/15 bg-black/25'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {block.highlight && (
                  <ShieldAlert className="h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
                )}
                <h3 className="editorial-underline font-serif text-2xl tracking-wide text-ivory uppercase sm:text-3xl">
                  {block.title}
                </h3>
              </div>

              {block.intro && (
                <p className="mt-4 text-sm leading-relaxed text-stone/95">{block.intro}</p>
              )}

              <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-stone/90">
                {block.items.map((item, idx) => (
                  <li key={`${block.id}-${idx}`} className="flex items-start gap-2.5">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-stone" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
