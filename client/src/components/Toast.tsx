import { createContext, useCallback, useContext } from 'react';
import { toast as sonnerToast } from 'sonner';

import { Toaster } from '@/components/ui/sonner';

type ToastType = 'success' | 'error' | 'info' | 'warning';
type AddToast = (msg: string, type?: ToastType, duration?: number) => void;

const ToastContext = createContext<AddToast | null>(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const addToast = useCallback<AddToast>((msg, type = 'info', duration = 3500) => {
    const show = type === 'info' ? sonnerToast : sonnerToast[type];
    show(msg, { duration });
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <Toaster position="bottom-right" closeButton />
    </ToastContext.Provider>
  );
}
