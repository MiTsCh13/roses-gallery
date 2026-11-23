// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import messages from "../../../messages/de.json";
import { PricingTable } from "@/components/marketing/pricing-table";
import { PLANS } from "@/lib/plans";
import { pricingPlans } from "@/lib/pricing";

afterEach(cleanup);

function renderTable() {
  return render(
    <NextIntlClientProvider locale="de" messages={messages}>
      <PricingTable
        plans={pricingPlans()}
        discountPercent={20}
        enterpriseAction={<a href="mailto:x@example.com">Anfrage</a>}
      />
    </NextIntlClientProvider>,
  );
}

const euro = (cents: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

describe("PricingTable", () => {
  it("shows exactly the plans, storage and prices from plans.ts", () => {
    renderTable();
    for (const plan of Object.values(PLANS)) {
      const card = screen.getByTestId(`plan-${plan.id}`);
      expect(card.textContent).toContain(plan.name);
      if (plan.priceMonthlyCents !== null) {
        expect(card.textContent).toContain(euro(plan.priceMonthlyCents));
      }
    }
    expect(screen.getByTestId("plan-free").textContent).toContain(
      messages.Pricing.freePrice,
    );
    expect(screen.getByTestId("plan-free").textContent).toContain(
      "bis zu 3 Galerien",
    );
    expect(screen.getByTestId("plan-enterprise").textContent).toContain(
      messages.Pricing.onRequest,
    );
    expect(screen.getByText("Anfrage")).toBeTruthy();
  });

  it("labels every paid price as gross (D-156)", () => {
    renderTable();
    for (const id of ["bud", "bloom", "bouquet"] as const) {
      const vat = screen
        .getByTestId(`plan-${id}`)
        .querySelector("[data-testid=vat]");
      expect(vat?.textContent).toBe("inkl. MwSt.");
    }
  });

  it("switches to yearly prices", () => {
    renderTable();
    const yearly = screen.getByRole("button", { name: /Jährlich/ });
    fireEvent.click(yearly);
    expect(yearly.getAttribute("aria-pressed")).toBe("true");
    for (const id of ["bud", "bloom", "bouquet"] as const) {
      const price = screen
        .getByTestId(`plan-${id}`)
        .querySelector("[data-testid=price]");
      expect(price?.textContent).toContain(euro(PLANS[id].priceYearlyCents!));
      expect(price?.textContent).toContain(messages.Pricing.perYear);
    }
  });

  it("marks plan features as planned", () => {
    renderTable();
    const bouquet = screen.getByTestId("plan-bouquet");
    expect(bouquet.textContent).toContain(
      messages.Pricing.features.white_label,
    );
    expect(bouquet.textContent).toContain(`(${messages.Pricing.planned})`);
    expect(screen.getByTestId("plan-bud").textContent).not.toContain(
      messages.Pricing.planned,
    );
  });
});
