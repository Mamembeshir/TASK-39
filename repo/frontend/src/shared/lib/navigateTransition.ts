import { startTransition } from 'react';
import type { NavigateOptions, To } from 'react-router-dom';

export function navigateTransition(navigate: (to: To, options?: NavigateOptions) => void, to: To, options?: NavigateOptions) {
  startTransition(() => {
    navigate(to, options);
  });
}
