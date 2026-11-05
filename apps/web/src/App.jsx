import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  queryClient,
  asyncPersister,
  shouldDehydrateQuery,
  CACHE_BUSTER_VERSION,
} from './config/queryClient.js';
import { useMasterDataFreshness } from './hooks/data/useMasterDataFreshness.js';
import { AuthProvider } from './stores/AuthContext';
import { I18nProvider } from './i18n/I18nContext';
import { RestaurantProvider } from './context/RestaurantContext';
import { AppRoutes } from './routes/AppRoutes';

function MasterDataFreshnessSync() {
  useMasterDataFreshness();
  return null;
}

export function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncPersister,
        buster: CACHE_BUSTER_VERSION,
        dehydrateOptions: {
          shouldDehydrateQuery,
        },
      }}
    >
      <BrowserRouter>
        <RestaurantProvider>
          <AuthProvider>
            <I18nProvider>
              <MasterDataFreshnessSync />
              <AppRoutes />
            </I18nProvider>
          </AuthProvider>
        </RestaurantProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  );
}

export default App;
