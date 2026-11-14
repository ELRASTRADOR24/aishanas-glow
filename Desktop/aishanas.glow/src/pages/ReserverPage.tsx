import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookingSection } from '../components/BookingSection';
import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import type { BookingVariant } from '../types/studio';

export const ReserverPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const serviceParam = searchParams.get('service');
  const variantParam = searchParams.get('variant') as BookingVariant | null;

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [serviceParam, variantParam]);

  return (
    <div className="min-h-dvh bg-paper text-charcoal">
      <Navbar />
      <main className="pt-16 sm:pt-20">
        <BookingSection
          preselectedServiceId={serviceParam}
          preselectedVariant={variantParam}
          selectionTick={1}
        />
      </main>
      <Footer />
    </div>
  );
};

export default ReserverPage;
