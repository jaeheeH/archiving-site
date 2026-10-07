"use client";

import { useEffect } from "react";
import { createDesignThemeStore } from "@/theme/theme-store";
import { myDesignSystemTheme } from "@/themes/my-design-system";
import { initializeColorMode } from "@/lib/color-mode";

export default function BalsaThemeActivation() {
  useEffect(() => {
    const store = createDesignThemeStore({ themes: [myDesignSystemTheme] });
    store.selectTheme(myDesignSystemTheme);
    initializeColorMode();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => initializeColorMode();
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'archb-color-mode' || event.key === null) update();
    };
    media.addEventListener('change', update);
    window.addEventListener('storage', onStorage);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return null;
}
