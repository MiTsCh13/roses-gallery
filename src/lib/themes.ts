import { z } from "zod";

export const FONT_STACKS = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  elegant: '"Palatino Linotype", Palatino, "Book Antiqua", serif',
} as const;

export const GRID_LAYOUTS = ["masonry", "uniform", "rows"] as const;
export const COVER_STYLES = ["full", "split", "minimal"] as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const themeConfigSchema = z.object({
  fonts: z.object({
    heading: z.enum(["serif", "sans", "elegant"]),
    body: z.enum(["serif", "sans", "elegant"]),
  }),
  colors: z.object({
    background: hexColor,
    text: hexColor,
    accent: hexColor,
    muted: hexColor,
  }),
  grid: z.object({
    layout: z.enum(GRID_LAYOUTS),
    gap: z.enum(["small", "medium", "large"]),
  }),
  cover: z.object({ style: z.enum(COVER_STYLES) }),
});

export type ThemeConfig = z.infer<typeof themeConfigSchema>;

export type SystemTheme = { id: string; name: string; config: ThemeConfig };

/**
 * The four system themes (accountId null). Their rows are inserted by
 * migration 0005 with these exact ids; themes.test.ts keeps both in sync.
 */
export const SYSTEM_THEMES: readonly SystemTheme[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Klassisch",
    config: {
      fonts: { heading: "serif", body: "serif" },
      colors: {
        background: "#ffffff",
        text: "#1f1f1f",
        accent: "#8c6d46",
        muted: "#6b6b6b",
      },
      grid: { layout: "uniform", gap: "medium" },
      cover: { style: "full" },
    },
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Modern",
    config: {
      fonts: { heading: "sans", body: "sans" },
      colors: {
        background: "#f7f7f5",
        text: "#111111",
        accent: "#2f5d50",
        muted: "#6f6f6f",
      },
      grid: { layout: "masonry", gap: "small" },
      cover: { style: "split" },
    },
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Romantisch",
    config: {
      fonts: { heading: "elegant", body: "sans" },
      colors: {
        background: "#fdf6f3",
        text: "#3a2a2a",
        accent: "#c0707b",
        muted: "#7a6363",
      },
      grid: { layout: "masonry", gap: "large" },
      cover: { style: "full" },
    },
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    name: "Dunkel",
    config: {
      fonts: { heading: "sans", body: "sans" },
      colors: {
        background: "#121212",
        text: "#f2f2f2",
        accent: "#d4af37",
        muted: "#a0a0a0",
      },
      grid: { layout: "rows", gap: "small" },
      cover: { style: "minimal" },
    },
  },
];

export const DEFAULT_THEME = SYSTEM_THEMES[0];

const GAPS = { small: "4px", medium: "12px", large: "24px" } as const;

/** CSS custom properties that apply a theme to a container. */
export function themeCssVars(config: ThemeConfig): Record<string, string> {
  return {
    "--g-bg": config.colors.background,
    "--g-text": config.colors.text,
    "--g-accent": config.colors.accent,
    "--g-muted": config.colors.muted,
    "--g-font-heading": FONT_STACKS[config.fonts.heading],
    "--g-font-body": FONT_STACKS[config.fonts.body],
    "--g-gap": GAPS[config.grid.gap],
  };
}
