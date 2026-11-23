// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) =>
    key === "badge" ? "Beta" : key,
}));

import { BetaBadge } from "./beta-badge";

afterEach(cleanup);

describe("BetaBadge", () => {
  it("shows the badge in beta mode", async () => {
    render(await BetaBadge({ beta: true }));
    expect(screen.getByTestId("beta-badge").textContent).toBe("Beta");
  });

  it("renders nothing outside the beta", async () => {
    expect(await BetaBadge({ beta: false })).toBeNull();
  });
});
