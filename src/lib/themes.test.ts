import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  SYSTEM_THEMES,
  themeConfigSchema,
  themeCssVars,
} from "./themes";

describe("system themes", () => {
  it("offers at least four valid, distinct themes", () => {
    expect(SYSTEM_THEMES.length).toBeGreaterThanOrEqual(4);
    for (const t of SYSTEM_THEMES) {
      expect(themeConfigSchema.safeParse(t.config).success).toBe(true);
    }
    expect(new Set(SYSTEM_THEMES.map((t) => t.id)).size).toBe(
      SYSTEM_THEMES.length,
    );
    expect(new Set(SYSTEM_THEMES.map((t) => t.name)).size).toBe(
      SYSTEM_THEMES.length,
    );
  });

  it("rejects invalid configs", () => {
    const bad = {
      ...DEFAULT_THEME.config,
      colors: { ...DEFAULT_THEME.config.colors, accent: "red" },
    };
    expect(themeConfigSchema.safeParse(bad).success).toBe(false);
    expect(
      themeConfigSchema.safeParse({ ...DEFAULT_THEME.config, grid: {} })
        .success,
    ).toBe(false);
  });

  it("maps a theme to CSS variables", () => {
    const vars = themeCssVars(DEFAULT_THEME.config);
    expect(vars["--g-bg"]).toBe("#ffffff");
    expect(vars["--g-gap"]).toBe("12px");
    expect(vars["--g-font-heading"]).toContain("Georgia");
  });
});

describe("system theme migrations", () => {
  it("insert the code constants (0005) and apply later color fixes (0012)", () => {
    const sql =
      readFileSync("drizzle/0005_system_themes.sql", "utf8") +
      readFileSync("drizzle/0012_theme_romantisch_contrast.sql", "utf8");
    for (const t of SYSTEM_THEMES) {
      expect(sql).toContain(t.id);
      expect(sql).toContain(`'${t.name}'`);
      if (t.name !== "Romantisch") {
        expect(sql).toContain(JSON.stringify(t.config));
      }
    }
    expect(sql).toContain(`"${SYSTEM_THEMES[2].config.colors.muted}"`);
    expect(sql.match(/::jsonb/g)).toHaveLength(SYSTEM_THEMES.length);
  });
});
