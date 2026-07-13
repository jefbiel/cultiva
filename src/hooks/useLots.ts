import { useCallback, useEffect, useState } from 'react';

import { createLot, CreateLotInput, listLots, updateLot } from '@/services/lots';
import { FieldLot } from '@/types/agro';

export function useLots() {
  const [lots, setLots] = useState<FieldLot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshLots = useCallback(async (): Promise<void> => {
    setLoading(true);
    setErrorMessage(null);

    try {
      setLots(await listLots());
    } catch {
      setErrorMessage('Não foi possível carregar os lotes.');
    } finally {
      setLoading(false);
    }
  }, []);

  const addLot = useCallback(async (input: CreateLotInput): Promise<FieldLot> => {
    const lot = await createLot(input);
    setLots((current) => [lot, ...current]);
    return lot;
  }, []);

  const saveLot = useCallback(async (lot: FieldLot): Promise<void> => {
    const updatedLot = await updateLot(lot);
    setLots((current) => current.map((item) => (item.id === updatedLot.id ? updatedLot : item)));
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void refreshLots();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [refreshLots]);

  return {
    lots,
    loading,
    errorMessage,
    refreshLots,
    addLot,
    saveLot,
  };
}
