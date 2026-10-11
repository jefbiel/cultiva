import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';

// Keep the iPhone's logical viewport intact when fitting a smaller desktop window.
export function WebViewport() {
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    const scale = Math.max(0.1, Math.min(1, (width - 48) / 444, (height - 48) / 942));
    document.documentElement.style.setProperty('--phone-scale', String(scale));
  }, [width, height]);

  return null;
}
