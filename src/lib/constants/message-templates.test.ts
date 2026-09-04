import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  unresolvedVariables,
  tidyRendered,
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

describe("tidyRendered", () => {
  /**
   * What a template with {{recogida}} + {{destino}} renders for an RMA that is
   * picked up and returned to the same address: the destination block comes out
   * empty and would otherwise leave a hole in the middle of the e-mail.
   */
  it("collapses the gap left by an empty placeholder on its own line", () => {
    expect(tidyRendered("Datos de recogida:\n- Bar Pepe\n\n\n\nQuedo a la espera.")).toBe(
      "Datos de recogida:\n- Bar Pepe\n\nQuedo a la espera."
    );
  });

  it("keeps a deliberate blank line between paragraphs", () => {
    expect(tidyRendered("Uno\n\nDos")).toBe("Uno\n\nDos");
  });

  it("strips the trailing spaces an empty value leaves behind", () => {
    expect(tidyRendered("Tracking:   \nFin")).toBe("Tracking:\nFin");
  });

  it("trims the edges", () => {
    expect(tidyRendered("\n\nHola\n\n")).toBe("Hola");
  });

  it("leaves clean text untouched", () => {
    const clean = "Buenos días,\n\nSolicitamos un RMA.\n\nUn saludo";
    expect(tidyRendered(clean)).toBe(clean);
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
