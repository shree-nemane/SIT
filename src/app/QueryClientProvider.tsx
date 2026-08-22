import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider as TanStackProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      refetchOnWindowFocus: false,
    },
  },
});

interface Props {
  children: ReactNode;
}

export const QueryClientProvider: React.FC<Props> = ({ children }) => {
  return <TanStackProvider client={queryClient}>{children}</TanStackProvider>;
};

export default QueryClientProvider;
