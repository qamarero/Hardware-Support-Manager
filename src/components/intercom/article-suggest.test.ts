import { describe, it, expect } from "vitest";
import { suggestArticles, matchDeviceType } from "./article-suggest";

const CATALOG = [
  { id: "1", deviceType: "Impresora WiFi", brand: "AQPROX", model: "WiFi 80mm" },
  { id: "2", deviceType: "Impresora USB/LAN", brand: "Aqprox", model: "USB 80mm" },
  { id: "3", deviceType: "TPV", brand: "Sunmi", model: "T2" },
  { id: "4", deviceType: "Impresora", brand: "Epson", model: "TM-T20" },
];

describe("suggestArticles", () => {
  it("matches the brand ignoring case and punctuation", () => {
    expect(suggestArticles(CATALOG, "aqprox").map((a) => a.id)).toEqual(["1", "2"]);
    expect(suggestArticles(CATALOG, "Aq-Prox").map((a) => a.id)).toEqual(["1", "2"]);
  });

  it("returns nothing without a brand", () => {
    expect(suggestArticles(CATALOG, "")).toEqual([]);
    expect(suggestArticles(CATALOG, "  ")).toEqual([]);
  });

  it("returns nothing for a brand that is not in the catalog", () => {
    expect(suggestArticles(CATALOG, "Bixolon")).toEqual([]);
  });

  it("does not match a brand that only contains the typed text", () => {
    expect(suggestArticles(CATALOG, "aq")).toEqual([]);
  });

  it("narrows by model when the model matches", () => {
    expect(suggestArticles(CATALOG, "AQPROX", "wifi").map((a) => a.id)).toEqual(["1"]);
    expect(suggestArticles(CATALOG, "Epson", "TM T20").map((a) => a.id)).toEqual(["4"]);
  });

  it("keeps every article of the brand when the model is not in the catalog", () => {
    expect(suggestArticles(CATALOG, "AQPROX", "58mm").map((a) => a.id)).toEqual(["1", "2"]);
  });
});

describe("matchDeviceType", () => {
  it("accepts the internal value", () => {
    expect(matchDeviceType("Printer WiFi")).toBe("Printer WiFi");
    expect(matchDeviceType("tpv")).toBe("TPV");
  });

  it("accepts the Spanish label", () => {
    expect(matchDeviceType("Impresora WiFi")).toBe("Printer WiFi");
    expect(matchDeviceType("impresora usb/lan")).toBe("Printer USB/LAN");
    expect(matchDeviceType("Cajon")).toBe("Cajón");
  });

  it("returns null when the type is ambiguous or unknown", () => {
    expect(matchDeviceType("Impresora")).toBeNull();
    expect(matchDeviceType("Báscula")).toBeNull();
    expect(matchDeviceType("")).toBeNull();
  });
});
