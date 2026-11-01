"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ThemeConfig } from "@/lib/themes";

export type ThemeOption = { id: string; name: string; config: ThemeConfig };

type State = {
  title: string;
  setTitle: (title: string) => void;
  themeId: string;
  config: ThemeConfig;
  themes: ThemeOption[];
  pickTheme: (id: string) => void;
  setConfig: (update: (c: ThemeConfig) => ThemeConfig) => void;
};

const Ctx = createContext<State | null>(null);

export function useEditorState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("EditorState is missing.");
  return ctx;
}

/**
 * Unsaved edits (title, theme, design) shared by the form fields on the left
 * and the live preview on the right, so the preview always shows what the
 * gallery will look like.
 */
export function EditorState({
  initialTitle,
  initialThemeId,
  initialConfig,
  themes,
  children,
}: {
  initialTitle: string;
  initialThemeId: string;
  initialConfig: ThemeConfig;
  themes: ThemeOption[];
  children: ReactNode;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [themeId, setThemeId] = useState(initialThemeId);
  const [config, setConfigState] = useState(initialConfig);

  const value = useMemo<State>(
    () => ({
      title,
      setTitle,
      themeId,
      config,
      themes,
      pickTheme: (id) => {
        const theme = themes.find((x) => x.id === id);
        if (!theme) return;
        setThemeId(id);
        setConfigState(theme.config);
      },
      setConfig: (update) => setConfigState(update),
    }),
    [title, themeId, config, themes],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
