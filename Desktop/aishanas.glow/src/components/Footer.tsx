import React from 'react';
import { Link } from 'react-router-dom';
import { useStudio } from '../context/StudioContext';

export const Footer: React.FC = () => {
  const { data } = useStudio();
  const { config } = data;

  return (
    <footer className="bg-obsidian px-4 py-12 text-stone sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end">
        <div>
          <img
            src="/logo-eyes-light.png"
            alt=""
            width={659}
            height={226}
            loading="lazy"
            className="mb-3 h-auto w-20 opacity-80"
          />
          <p className="font-serif text-2xl text-ivory">{config.brandName}</p>
          <p className="mt-1 text-xs text-stone/80">{config.tagline}</p>
          <p className="mt-2 text-xs text-stone/70">
            {config.locationLine} · {config.certificationLine}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs tracking-wider uppercase">
          <a href="#tarifs" className="hover:text-ivory">
            Tarifs
          </a>
          <a href="#protocoles" className="hover:text-ivory">
            Protocoles
          </a>
          <a href="#reservation" className="hover:text-ivory">
            Réserver
          </a>
          <a
            href={config.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ivory"
          >
            {config.handle}
          </a>
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-5xl flex-col items-start justify-between gap-3 text-[11px] text-stone/60 sm:flex-row sm:items-center">
        <p>
          © {new Date().getFullYear()} {config.brandName} — {config.city}. Tous droits réservés.
        </p>
        <Link to="/admin" className="underline-offset-4 transition-colors hover:text-stone hover:underline">
          Administration du studio
        </Link>
      </div>
    </footer>
  );
};
