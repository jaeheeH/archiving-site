"use client";

import { useEffect } from "react";
import { createDesignThemeStore } from "@/theme/theme-store";
import { myDesignSystemTheme } from "@/themes/my-design-system";

export default function BalsaThemeActivation() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    const store = createDesignThemeStore({ themes: [myDesignSystemTheme] });
    store.selectTheme(myDesignSystemTheme);
  }, []);

  return null;
}
