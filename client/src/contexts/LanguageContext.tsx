import React, { createContext, useContext, useState } from "react";

export type Language = "pt" | "en";

export const translations = {
  pt: {
    // Nav labels
    dashboard: "Dashboard",
    chat: "Chat com IA",
    images: "Gerar Imagens",
    videos: "Videos IA",
    articles: "Artigos",
    carousel: "Carrossel",
    posts: "Postagens",
    analytics: "Analytics",
    settings: "Configurações",
    // Nav descriptions
    dashboardDesc: "Visão geral",
    chatDesc: "Converse com IA",
    imagesDesc: "Crie imagens com IA",
    videosDesc: "Avatares em video",
    articlesDesc: "Gere artigos automáticos",
    carouselDesc: "Crie carrosséis com IA",
    postsDesc: "Automatize suas redes",
    analyticsDesc: "Insights do Instagram",
    settingsDesc: "Conta e integrações",
    // Sections
    modules: "Módulos",
    system: "Sistema",
    // Footer
    platformName: "Plataforma de Marketing",
    darkTheme: "Tema escuro",
    lightTheme: "Tema claro",
    logout: "Sair",
    // Language toggle
    language: "Idioma",
    langPt: "PT",
    langEn: "EN",
  },
  en: {
    dashboard: "Dashboard",
    chat: "AI Chat",
    images: "Generate Images",
    videos: "AI Videos",
    articles: "Articles",
    carousel: "Carousel",
    posts: "Posts",
    analytics: "Analytics",
    settings: "Settings",
    dashboardDesc: "Overview",
    chatDesc: "Chat with AI",
    imagesDesc: "Create AI images",
    videosDesc: "Video avatars",
    articlesDesc: "Auto-generate articles",
    carouselDesc: "Create AI carousels",
    postsDesc: "Automate your networks",
    analyticsDesc: "Instagram insights",
    settingsDesc: "Account & integrations",
    modules: "Modules",
    system: "System",
    platformName: "Marketing Platform",
    darkTheme: "Dark theme",
    lightTheme: "Light theme",
    logout: "Sign out",
    language: "Language",
    langPt: "PT",
    langEn: "EN",
  },
} as const;

export type TranslationKey = keyof typeof translations.pt;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem("language") as Language) || "pt";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("language", lang);
  };

  const t = (key: TranslationKey): string => translations[language][key];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
