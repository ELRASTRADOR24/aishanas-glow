import React from 'react';
import { FaqSection } from '../components/FaqSection';
import { Footer } from '../components/Footer';
import { Hero } from '../components/Hero';
import { InstagramSpotlight } from '../components/InstagramSpotlight';
import { Navbar } from '../components/Navbar';
import { ProtocolsSection } from '../components/ProtocolsSection';
import { TariffCards } from '../components/TariffCards';

export const HomePage: React.FC = () => {
  return (
    <div className="min-h-dvh bg-paper text-charcoal">
      <Navbar />
      <main>
        <Hero />
        <TariffCards />
        <ProtocolsSection />
        <FaqSection />
        <InstagramSpotlight />
      </main>
      <Footer />
    </div>
  );
};

export default HomePage;
