import React from 'react';
import { Instagram } from 'lucide-react';
import { useStudio } from '../context/StudioContext';

export const Navbar: React.FC = () => {
  const { data } = useStudio();
  const { config } = data;

  return (
    <header className="sticky top-0 z-40 border-b border-stone/60 bg-paper/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <a
          href="#top"
          className="inline-flex items-center gap-2.5 font-serif text-xl font-semibold tracking-tight text-charcoal sm:text-2xl"
        >
          <img
            src="/logo-eyes-dark.png"
            alt=""
            width={659}
            height={226}
            className="h-5 w-auto shrink-0 sm:h-6"
          />
          <span>{config.brandName}</span>
        </a>

        <nav aria-label="Navigation principale" className="flex items-center gap-4 sm:gap-7">
          <a
            href="#tarifs"
            className="hidden text-xs font-medium tracking-widest text-taupe uppercase transition-colors hover:text-charcoal sm:inline-block"
          >
            Tarifs
          </a>
          <a
            href="#protocoles"
            className="hidden text-xs font-medium tracking-widest text-taupe uppercase transition-colors hover:text-charcoal sm:inline-block"
          >
            Soins & Protocoles
          </a>
          <a
            href="#reservation"
            className="inline-flex min-h-[44px] items-center border border-charcoal bg-charcoal px-4 py-2 text-xs font-medium tracking-widest text-ivory uppercase transition-colors hover:bg-silk"
          >
            Réserver
          </a>
          <a
            href={config.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Instagram ${config.handle}`}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center border border-stone text-charcoal transition-colors hover:border-charcoal"
          >
            <Instagram className="h-4 w-4" aria-hidden="true" />
          </a>
        </nav>
      </div>
    </header>
  );
};
