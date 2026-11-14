import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StudioProvider } from './context/StudioContext';
import { AdminPage } from './pages/AdminPage';
import { HomePage } from './pages/HomePage';
import { ReserverPage } from './pages/ReserverPage';

export const App: React.FC = () => {
  return (
    <StudioProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/reserver" element={<ReserverPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StudioProvider>
  );
};

export default App;
