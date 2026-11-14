import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';
import { useStudio } from '../context/StudioContext';

export const Navbar: React.FC = () => {
  const { data } = useStudio();
  const { config } = data;

  const handleNavAnchor = (hash: string) => (e: React.MouseEvent) => {
    if (window.location.pathname === '/') {
      e.preventDefault();
      const id = hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        window.history.pushState(null, '', `/#${id}`);
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone/70 bg-paper/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Link
          to="/"
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
        </Link>

        <nav aria-label="Navigation principale" className="flex items-center gap-4 sm:gap-7">
          <Link
            to="/#tarifs"
            onClick={handleNavAnchor('#tarifs')}
            className="hidden text-xs font-medium tracking-widest text-taupe uppercase transition-colors hover:text-charcoal sm:inline-block"
          >
            Tarifs
          </Link>
          <Link
            to="/#protocoles"
            onClick={handleNavAnchor('#protocoles')}
            className="hidden text-xs font-medium tracking-widest text-taupe uppercase transition-colors hover:text-charcoal sm:inline-block"
          >
            Protocoles
          </Link>
          <Link
            to="/#faq"
            onClick={handleNavAnchor('#faq')}
            className="hidden text-xs font-medium tracking-widest text-taupe uppercase transition-colors hover:text-charcoal sm:inline-block"
          >
            FAQ
          </Link>
          <Link
            to="/reserver"
            className="inline-flex min-h-[44px] items-center border border-charcoal bg-charcoal px-4 py-2 text-xs font-medium tracking-widest text-ivory uppercase transition-colors hover:bg-silk"
          >
            Réserver
          </Link>
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
