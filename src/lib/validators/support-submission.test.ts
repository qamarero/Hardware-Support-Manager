import { describe, it, expect } from "vitest";
import { createSubmissionSchema } from "./support-submission";

const base = {
  submitterName: "Guillermo Mateos",
  submitterEmail: "guillermo.mateos@qamarero.com",
  clientName: "Maxxbur",
  title: "TPV no enciende",
  description: "El TPV no arranca tras el corte de luz de anoche.",
  priority: "media" as const,
};

describe("createSubmissionSchema · ID de restaurante tecleado a mano", () => {
  it("acepta un restaurant_id bien formado", () => {
    const r = createSubmissionSchema.safeParse({
      ...base,
      manualClientExternalId: "27673a49-1e4d-4172-a611-5dc27f6906f7",
    });
    expect(r.success).toBe(true);
  });

  it("acepta mayusculas en el id", () => {
    const r = createSubmissionSchema.safeParse({
      ...base,
      manualClientExternalId: "27673A49-1E4D-4172-A611-5DC27F6906F7",
    });
    expect(r.success).toBe(true);
  });

  it("es opcional: el caso normal es elegir del buscador", () => {
    expect(createSubmissionSchema.safeParse(base).success).toBe(true);
    expect(createSubmissionSchema.safeParse({ ...base, manualClientExternalId: "" }).success).toBe(true);
  });

  it("rechaza un id cortado", () => {
    const r = createSubmissionSchema.safeParse({ ...base, manualClientExternalId: "27673a49-1e4d" });
    expect(r.success).toBe(false);
  });

  it("rechaza texto que no es un id", () => {
    for (const malo of ["Maxxbur", "12345", "27673a49 1e4d 4172 a611 5dc27f6906f7"]) {
      expect(createSubmissionSchema.safeParse({ ...base, manualClientExternalId: malo }).success).toBe(false);
    }
  });

  it("rechaza un id con un caracter no hexadecimal", () => {
    const r = createSubmissionSchema.safeParse({
      ...base,
      manualClientExternalId: "27673z49-1e4d-4172-a611-5dc27f6906f7",
    });
    expect(r.success).toBe(false);
  });
});
