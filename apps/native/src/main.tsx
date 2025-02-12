import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import React from 'react';
import ReactDOM from 'react-dom/client';

// Prevent overscroll behavior
const style = document.createElement('style');
style.textContent = `
  html, body {
    overflow: hidden;
    position: fixed;
    inset: 0;
    height: 100%;
  }
  #root {
    height: 100%;
    overflow-y: auto;
  }
`;
document.head.appendChild(style);

import '@acme/ui/globals.css';

// Import the generated routes
import { routeTree } from './routeTree.gen';

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
