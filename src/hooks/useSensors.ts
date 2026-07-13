import { useEffect, useState } from 'react';

import { connectMockIotStream } from '@/services/iot';
import { FieldLot, PlantingRowSensor } from '@/types/agro';

export function useSensors(lots: FieldLot[]) {
  const [rows, setRows] = useState<PlantingRowSensor[]>([]);
  const connected = lots.length > 0;

  useEffect(() => {
    const unsubscribe = connectMockIotStream(lots, setRows);

    return unsubscribe;
  }, [lots]);

  return {
    rows,
    connected,
  };
}
