import React, { useState } from 'react';
import { BookingSection } from '../components/BookingSection';
import { Footer } from '../components/Footer';
import { Hero } from '../components/Hero';
import { InstagramSpotlight } from '../components/InstagramSpotlight';
import { Navbar } from '../components/Navbar';
import { ProtocolsSection } from '../components/ProtocolsSection';
import { TariffCards } from '../components/TariffCards';
import type { BookingVariant } from '../types/studio';

export const HomePage: React.FC = () => {
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<BookingVariant | null>(null);
  const [selectionTick, setSelectionTick] = useState(0);

  const handleSelectServiceForBooking = (serviceId: string, variant: BookingVariant) => {
    setSelectedServiceId(serviceId);
    setSelectedVariant(variant);
    setSelectionTick((t) => t + 1);
  };

  return (
    <div className="min-h-dvh bg-paper text-charcoal">
      <Navbar />
      <main>
        <Hero />
        <TariffCards onSelectServiceForBooking={handleSelectServiceForBooking} />
        <ProtocolsSection />
        <BookingSection
          preselectedServiceId={selectedServiceId}
          preselectedVariant={selectedVariant}
          selectionTick={selectionTick}
        />
        <InstagramSpotlight />
      </main>
      <Footer />
    </div>
  );
};
