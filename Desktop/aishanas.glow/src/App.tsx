import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { StudioProvider } from './context/StudioContext';
import { AdminPage } from './pages/AdminPage';
import { HomePage } from './pages/HomePage';
import { ReserverPage } from './pages/ReserverPage';
import { OptionConfirmationPage } from './pages/OptionConfirmationPage';

const ScrollToTop: React.FC = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, search]);

  return null;
};

export const App: React.FC = () => {
  return (
    <StudioProvider>
      <BrowserRouter>
        <ScrollToTop />
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
