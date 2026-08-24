import { useState, useRef, useCallback } from 'react';

/**
 * useActionGuard
 * 
 * A hook to wrap async actions (like form submissions or button clicks) to prevent 
 * rapid double-clicks and overlapping requests.
 * 
 * Uses a synchronous `useRef` to instantly block subsequent calls before React 
 * has a chance to re-render, solving the classic React double-submit bug.
 * 
 * @param action The async function to wrap.
 * @returns An object containing `isProcessing` state and the `guardedAction` function.
 */
export function useActionGuard<T extends (...args: any[]) => Promise<any>>(action: T) {
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);

  const guardedAction = useCallback(async (...args: Parameters<T>) => {
    // Synchronously block if already processing
    if (isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    setIsProcessing(true);
    
    try {
      await action(...args);
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }, [action]);

  return { isProcessing, guardedAction, setIsProcessing };
}
