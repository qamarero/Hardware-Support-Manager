import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  unresolvedVariables,
  variablesForCategory,
  INCIDENT_TEMPLATE_VARIABLES,
  RMA_TEMPLATE_VARIABLES,
} from "./message-templates";

describe("renderTemplate", () => {
  it("substitutes known variables", () => {
    expect(renderTemplate("Hola {{clientName}}", { clientName: "Bar Pepe" })).toBe(
      "Hola Bar Pepe"
    );
  });

  it("substitutes a known variable that is empty", () => {
    expect(renderTemplate("Tracking: {{trackingNumberOutgoing}}", { trackingNumberOutgoing: "" })).toBe(
      "Tracking: "
    );
  });

  it("keeps an unknown variable literal instead of dropping it silently", () => {
    expect(renderTemplate("Nº {{typoedKey}}", { clientName: "x" })).toBe("Nº {{typoedKey}}");
  });

  it("substitutes every occurrence", () => {
    expect(renderTemplate("{{a}} y {{a}}", { a: "1" })).toBe("1 y 1");
  });
});

describe("unresolvedVariables", () => {
  it("returns nothing when everything was substituted", () => {
    expect(unresolvedVariables("Todo listo, sin huecos")).toEqual([]);
  });

  it("reports the placeholders left behind", () => {
    expect(unresolvedVariables("Nº {{incidentNumber}}\n{{description}}")).toEqual([
      "incidentNumber",
      "description",
    ]);
  });

  it("does not repeat a placeholder used twice", () => {
    expect(unresolvedVariables("{{a}} {{a}}")).toEqual(["a"]);
  });
});

describe("variablesForCategory", () => {
  it("offers the RMA catalogue for provider templates", () => {
    expect(variablesForCategory("proveedor")).toBe(RMA_TEMPLATE_VARIABLES);
  });

  it("offers the incident catalogue for client templates", () => {
    expect(variablesForCategory("cliente")).toBe(INCIDENT_TEMPLATE_VARIABLES);
  });

  /**
   * The bug this guards against: the editor used to offer every variable
   * regardless of category, so a provider template could use
   * `{{incidentNumber}}`, which the RMA e-mail could not fill — and the
   * placeholder travelled to the provider verbatim.
   */
  it("never offers a provider variable that the RMA e-mail cannot fill", () => {
    const filledByRmaEmail = [
      "rmaNumber",
      "providerName",
      "providerRmaNumber",
      "trackingNumberOutgoing",
      "trackingNumberReturn",
      "status",
      "notes",
      "deviceType",
      "deviceBrand",
      "deviceModel",
      "deviceSerialNumber",
      "clientName",
      "incidentNumber",
      "title",
      "description",
      "category",
      "priority",
      "hardwareOrigin",
      "assignedUserName",
      "intercomUrl",
      "intercomEscalationId",
      "contactName",
      "contactPhone",
      "contactEmail",
      "pickupAddress",
      "pickupCity",
      "pickupPostalCode",
      "recogida",
      "destino",
    ];
    const offered = RMA_TEMPLATE_VARIABLES.map((v) => v.key);
    expect(offered.filter((k) => !filledByRmaEmail.includes(k))).toEqual([]);
  });

  it("keeps the internal Intercom links out of provider templates", () => {
    const offered = RMA_TEMPLATE_VARIABLES.map((v) => v.key);
    expect(offered).not.toContain("intercomUrl");
    expect(offered).not.toContain("intercomEscalationId");
  });
});
