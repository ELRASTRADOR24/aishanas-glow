import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { StudioProvider } from './context/StudioContext';
import { AdminPage } from './pages/AdminPage';
import { HomePage } from './pages/HomePage';
import { ReserverPage } from './pages/ReserverPage';
import { OptionConfirmationPage } from './pages/OptionConfirmationPage';

const ScrollManager: React.FC = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        const timer = setTimeout(() => {
          const delayedEl = document.getElementById(id);
          delayedEl?.scrollIntoView({ behavior: 'smooth' });
        }, 120);
        return () => clearTimeout(timer);
      }
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [pathname, hash]);

  return null;
};

export const App: React.FC = () => {
  return (
    <StudioProvider>
      <BrowserRouter>
        <ScrollManager />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/reserver" element={<ReserverPage />} />
          <Route path="/confirmation-option" element={<OptionConfirmationPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StudioProvider>
  );
};

export default App;
