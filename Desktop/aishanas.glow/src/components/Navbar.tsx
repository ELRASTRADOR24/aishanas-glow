import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Menu, X } from 'lucide-react';
import { useStudio } from '../context/StudioContext';

export const Navbar: React.FC = () => {
  const { data } = useStudio();
  const { config } = data;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToAnchor = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const headerOffset = 70;
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
      window.history.pushState(null, '', `/#${id}`);
    }
  };

  const handleNavAnchor = (hash: string) => (e: React.MouseEvent) => {
    const id = hash.replace('#', '');
    if (window.location.pathname === '/') {
      e.preventDefault();
      scrollToAnchor(id);
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone/70 bg-paper/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Link
          to="/"
          onClick={() => {
            if (window.location.pathname === '/') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            setMobileMenuOpen(false);
          }}
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

        {/* Desktop links */}
        <nav aria-label="Navigation principale" className="hidden items-center gap-7 md:flex">
          <Link
            to="/#tarifs"
            onClick={handleNavAnchor('#tarifs')}
            className="text-xs font-medium tracking-widest text-taupe uppercase transition-colors hover:text-charcoal"
          >
            Tarifs
          </Link>
          <Link
            to="/#protocoles"
            onClick={handleNavAnchor('#protocoles')}
            className="text-xs font-medium tracking-widest text-taupe uppercase transition-colors hover:text-charcoal"
          >
            Protocoles
          </Link>
          <Link
            to="/#faq"
            onClick={handleNavAnchor('#faq')}
            className="text-xs font-medium tracking-widest text-taupe uppercase transition-colors hover:text-charcoal"
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

        {/* Mobile controls */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            to="/reserver"
            className="inline-flex min-h-[40px] items-center border border-charcoal bg-charcoal px-3 py-1.5 text-[11px] font-medium tracking-widest text-ivory uppercase transition-colors hover:bg-silk"
          >
            Réserver
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center border border-stone text-charcoal transition-colors hover:border-charcoal"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-stone/60 bg-paper px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3 text-sm tracking-wider uppercase">
            <Link
              to="/#tarifs"
              onClick={handleNavAnchor('#tarifs')}
              className="py-2 text-taupe transition-colors hover:text-charcoal"
            >
              Tarifs &amp; Prestations
            </Link>
            <Link
              to="/#protocoles"
              onClick={handleNavAnchor('#protocoles')}
              className="py-2 text-taupe transition-colors hover:text-charcoal"
            >
              Protocoles de soin
            </Link>
            <Link
              to="/#faq"
              onClick={handleNavAnchor('#faq')}
              className="py-2 text-taupe transition-colors hover:text-charcoal"
            >
              Questions fréquentes (FAQ)
            </Link>
            <a
              href={config.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 py-2 text-taupe transition-colors hover:text-charcoal"
            >
              <Instagram className="h-4 w-4" />
              <span>{config.handle}</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
