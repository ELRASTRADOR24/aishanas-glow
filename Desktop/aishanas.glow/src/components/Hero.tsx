import React from 'react';
import { ArrowDownRight, Instagram, MapPin } from 'lucide-react';
import { useStudio } from '../context/StudioContext';

export const Hero: React.FC = () => {
  const { data } = useStudio();
  const { config } = data;

  return (
    <section
      id="top"
      className="surface-silk relative overflow-hidden border-b border-silk px-4 py-14 sm:px-6 sm:py-24"
    >
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <img
          src="/logo-eyes-light.png"
          alt={config.brandName}
          width={659}
          height={226}
          fetchPriority="high"
          className="mx-auto mb-5 h-auto w-28 opacity-95 sm:w-36"
        />

        <p className="mb-4 text-[11px] font-medium tracking-[0.26em] text-stone uppercase sm:text-xs">
          {config.certificationLine} · {config.city}
        </p>

        <h1 className="mx-auto max-w-3xl font-serif text-4xl leading-[1.08] font-normal text-ivory sm:text-6xl">
          {config.heroTitle}
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-stone/90 sm:text-base">
          {config.heroSubtitle}
        </p>

        <div className="mt-4 inline-flex items-center justify-center gap-2 text-xs tracking-wide text-stone/80">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{config.locationLine}</span>
        </div>

        <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <a
            href="#reservation"
            className="inline-flex min-h-[50px] items-center justify-center gap-2 border border-ivory bg-ivory px-7 py-3 text-xs font-semibold tracking-[0.2em] text-obsidian uppercase transition-colors hover:bg-stone"
          >
            <span>Prendre rendez-vous</span>
            <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <a
            href="#tarifs"
            className="inline-flex min-h-[50px] items-center justify-center border border-stone/50 px-7 py-3 text-xs font-medium tracking-[0.2em] text-ivory uppercase transition-colors hover:border-ivory"
          >
            Carte des tarifs
          </a>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6">
          <a
            href={config.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 text-xs tracking-[0.18em] text-stone uppercase transition-colors hover:text-ivory"
          >
            <Instagram className="h-4 w-4" aria-hidden="true" />
            <span>Réalisations & Contact rapide : {config.handle}</span>
          </a>
        </div>
      </div>
    </section>
  );
};
