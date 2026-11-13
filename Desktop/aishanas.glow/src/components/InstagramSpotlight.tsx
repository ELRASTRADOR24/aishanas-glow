import React from 'react';
import { ArrowUpRight, Instagram } from 'lucide-react';
import { useStudio } from '../context/StudioContext';

export const InstagramSpotlight: React.FC = () => {
  const { data } = useStudio();
  const { config } = data;

  return (
    <section
      aria-labelledby="instagram-heading"
      className="surface-silk border-b border-silk px-4 py-14 sm:px-6 sm:py-20"
    >
      <div className="relative z-10 mx-auto max-w-4xl border border-white/20 bg-black/35 p-7 text-center sm:p-12">
        <div className="mx-auto flex h-12 w-12 items-center justify-center border border-white/25 text-ivory">
          <Instagram className="h-5 w-5" aria-hidden="true" />
        </div>

        <p className="mt-5 text-[11px] font-medium tracking-[0.25em] text-stone uppercase">
          Source officielle & Galeries complètes
        </p>

        <h2 id="instagram-heading" className="mt-2 font-serif text-3xl text-ivory sm:text-5xl">
          {config.instagramBannerTitle}
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-stone/90">
          {config.instagramBannerText}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={config.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 border border-ivory bg-ivory px-8 py-3.5 text-xs font-semibold tracking-[0.2em] text-obsidian uppercase transition-colors hover:bg-stone sm:w-auto"
          >
            <Instagram className="h-4 w-4" aria-hidden="true" />
            <span>Accéder à {config.handle}</span>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
};
