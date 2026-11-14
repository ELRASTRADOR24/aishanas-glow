import React from 'react';
import { ArrowDownRight, MapPin } from 'lucide-react';
import { useStudio } from '../context/StudioContext';

export const Hero: React.FC = () => {
  const { data } = useStudio();
  const { config } = data;

  return (
    <section
      id="top"
      className="surface-silk relative overflow-hidden border-b border-silk px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <img
          src="/logo-eyes-light.png"
          alt={config.brandName}
          width={659}
          height={226}
          fetchPriority="high"
          className="mx-auto mb-6 h-auto w-28 opacity-95 sm:w-36"
        />

        <p className="mb-3 text-[11px] font-medium tracking-[0.28em] text-stone uppercase">
          Studio Privé · {config.city}
        </p>

        <h1 className="mx-auto max-w-2xl font-serif text-4xl leading-[1.1] font-normal text-ivory sm:text-6xl">
          L’art du regard et de l’éclat sur mesure
        </h1>

        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-stone/90 sm:text-base font-light">
          Extensions de cils haute précision, rehaussement et blanchiment dentaire.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="/reserver"
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 border border-ivory bg-ivory px-8 py-3 text-xs font-semibold tracking-[0.2em] text-obsidian uppercase transition-colors hover:bg-stone sm:w-auto"
          >
            <span>Réserver un soin</span>
            <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <a
            href="#tarifs"
            className="inline-flex min-h-[48px] w-full items-center justify-center border border-stone/50 px-8 py-3 text-xs font-medium tracking-[0.2em] text-ivory uppercase transition-colors hover:border-ivory sm:w-auto"
          >
            Carte des prestations
          </a>
        </div>

        <div className="mt-8 inline-flex items-center justify-center gap-2 text-xs tracking-wider text-stone/70">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Place Napoléon, {config.city}</span>
        </div>
      </div>
    </section>
  );
};
