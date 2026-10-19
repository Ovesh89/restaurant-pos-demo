import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './stores/AuthContext';
import { I18nProvider } from './i18n/I18nContext';
import { RestaurantProvider } from './context/RestaurantContext';
import { AppRoutes } from './routes/AppRoutes';

export function App() {
  return (
    <BrowserRouter>
      <RestaurantProvider>
        <AuthProvider>
          <I18nProvider>
            <AppRoutes />
          </I18nProvider>
        </AuthProvider>
      </RestaurantProvider>
    </BrowserRouter>
  );
}

export default App;
