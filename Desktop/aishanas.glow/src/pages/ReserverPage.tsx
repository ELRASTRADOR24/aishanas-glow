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

  return (
    <div className="min-h-dvh bg-paper text-charcoal">
      <Navbar />
      <main className="pt-20 sm:pt-28">
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
