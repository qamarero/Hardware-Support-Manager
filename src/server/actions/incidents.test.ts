import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth/get-session", () => ({
  getRequiredSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Técnico", role: "technician" },
  }),
  requireRole: vi.fn().mockResolvedValue(undefined),
  requireWriteAccess: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Técnico", role: "technician" },
  }),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock next/server `after` (sync a Intercom fire-and-forget; sin request scope en tests)
vi.mock("next/server", () => ({
  after: vi.fn(),
}));

// Mock id generator
vi.mock("@/lib/utils/id-generator", () => ({
  generateSequentialId: vi.fn().mockResolvedValue("INC-2026-00001"),
}));

// DB mock setup
const mockTxInsertValues = vi.fn();
const mockTxInsertReturning = vi.fn();
const mockTxUpdateSet = vi.fn();
const mockTxUpdateWhere = vi.fn();
const mockTxUpdateReturning = vi.fn();
const mockTxSelectFrom = vi.fn();
const mockTxSelectWhere = vi.fn();
const mockTxSelectFor = vi.fn();
const mockTxSelectLimit = vi.fn();

function createMockTx() {
  return {
    insert: () => ({
      values: (data: unknown) => {
        mockTxInsertValues(data);
        return {
          returning: (cols: unknown) => {
            mockTxInsertReturning(cols);
            return [{ id: "inc-uuid-1" }];
          },
        };
      },
    }),
    update: () => ({
      set: (data: unknown) => {
        mockTxUpdateSet(data);
        return {
          where: (condition: unknown) => {
            mockTxUpdateWhere(condition);
            return {
              returning: (cols: unknown) => {
                mockTxUpdateReturning(cols);
                return [{ id: "inc-uuid-1" }];
              },
            };
          },
        };
      },
    }),
    select: () => ({
      from: () => {
        mockTxSelectFrom();
        return {
          where: (condition: unknown) => {
            mockTxSelectWhere(condition);
            return {
              for: () => {
                mockTxSelectFor();
                return {
                  limit: () => {
                    mockTxSelectLimit();
                    return [{ status: "nuevo", stateChangedAt: new Date(), slaPausedMs: "0" }];
                  },
                };
              },
            };
          },
        };
      },
    }),
  };
}

vi.mock("@/lib/db", () => ({
  db: {
    transaction: async (fn: (tx: ReturnType<typeof createMockTx>) => Promise<unknown>) => {
      const tx = createMockTx();
      return fn(tx);
    },
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Object.assign([], { limit: () => [] }),
          limit: () => [],
        }),
      }),
    }),
  },
}));

// Mock queries
vi.mock("@/server/queries/incidents", () => ({
  getIncidents: vi.fn().mockResolvedValue({
    data: [],
    totalCount: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  }),
  getIncidentById: vi.fn().mockResolvedValue(null),
  getLinkedRmas: vi.fn().mockResolvedValue([]),
}));

// Mock intercom sync (fire-and-forget, no-op in tests)
vi.mock("@/lib/intercom/sync", () => ({
  syncIncidentTransition: vi.fn(),
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
    notInArray: vi.fn((...args: unknown[]) => ({ type: "notInArray", args })),
  };
});

const { createIncident, updateIncident, transitionIncident, fetchUsersForSelect, fetchIncidentsForSelect } = await import("./incidents");

const VALID_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("Server Actions: Incidents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createIncident", () => {
    it("should create an incident with valid data", async () => {
      const result = await createIncident({
        title: "TPV no enciende",
        category: "escalado",
        hardwareOrigin: "qamarero",
        priority: "alta",
        clientName: "Bar El Rincón",
        description: "El TPV no enciende desde ayer",
        assignedUserId: "",
        deviceType: "tpv",
        deviceBrand: "Epson",
        deviceModel: "TM-T20",
        deviceSerialNumber: "SN12345",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("inc-uuid-1");
      }
      expect(mockTxInsertValues).toHaveBeenCalledTimes(2); // incident + event_log
      expect(mockTxInsertValues).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          incidentNumber: "INC-2026-00001",
          title: "TPV no enciende",
          category: "escalado",
          priority: "alta",
          clientName: "Bar El Rincón",
          deviceType: "tpv",
          deviceBrand: "Epson",
        })
      );
      expect(mockTxInsertValues).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          entityType: "incident",
          action: "created",
          toState: "nuevo",
        })
      );
    });

    it("should create with minimal required fields", async () => {
      const result = await createIncident({
        title: "Problema genérico",
        category: "otro",
        hardwareOrigin: "cliente_reciclado",
        priority: "baja",
      });

      expect(result.success).toBe(true);
      expect(mockTxInsertValues).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          title: "Problema genérico",
          category: "otro",
          hardwareOrigin: "cliente_reciclado",
          priority: "baja",
          clientName: null,
          assignedUserId: null,
          deviceType: null,
        })
      );
    });

    it("should reject creation without hardwareOrigin", async () => {
      const result = await createIncident({
        title: "Falta origen",
        category: "escalado",
        priority: "media",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Datos inválidos");
      }
    });

    it("should convert empty strings to null for optional fields", async () => {
      const result = await createIncident({
        title: "Test empty strings",
        category: "incidencia_directa",
        hardwareOrigin: "qamarero",
        priority: "media",
        clientName: "",
        assignedUserId: "",
        deviceType: "",
        deviceBrand: "",
        deviceModel: "",
        deviceSerialNumber: "",
        description: "",
      });

      expect(result.success).toBe(true);
      expect(mockTxInsertValues).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          clientName: null,
          assignedUserId: null,
          deviceType: null,
          deviceBrand: null,
          deviceModel: null,
          deviceSerialNumber: null,
          description: null,
        })
      );
    });

    it("should reject invalid data (missing title)", async () => {
      const result = await createIncident({
        category: "escalado",
        hardwareOrigin: "qamarero",
        priority: "alta",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Datos inválidos");
      }
    });

    it("should reject invalid category", async () => {
      const result = await createIncident({
        title: "Test",
        category: "invalid_category",
        hardwareOrigin: "qamarero",
        priority: "alta",
      });

      expect(result.success).toBe(false);
    });

    it("should reject legacy category value (hardware)", async () => {
      const result = await createIncident({
        title: "Test",
        category: "hardware",
        hardwareOrigin: "qamarero",
        priority: "alta",
      });

      expect(result.success).toBe(false);
    });

    it("should reject invalid priority", async () => {
      const result = await createIncident({
        title: "Test",
        category: "escalado",
        hardwareOrigin: "qamarero",
        priority: "urgente",
      });

      expect(result.success).toBe(false);
    });

    it("should accept all valid categories", async () => {
      const categories = ["escalado", "incidencia_directa", "mencion", "otro"];

      for (const category of categories) {
        vi.clearAllMocks();
        const result = await createIncident({
          title: `Test ${category}`,
          category,
          hardwareOrigin: "qamarero",
          priority: "media",
        });
        expect(result.success).toBe(true);
      }
    });

    it("should accept all valid priorities", async () => {
      const priorities = ["baja", "media", "alta", "critica"];

      for (const priority of priorities) {
        vi.clearAllMocks();
        const result = await createIncident({
          title: `Test ${priority}`,
          category: "escalado",
          hardwareOrigin: "qamarero",
          priority,
        });
        expect(result.success).toBe(true);
      }
    });

    it("should accept both hardwareOrigin values", async () => {
      for (const hardwareOrigin of ["qamarero", "cliente_reciclado"]) {
        vi.clearAllMocks();
        const result = await createIncident({
          title: `Test ${hardwareOrigin}`,
          category: "escalado",
          hardwareOrigin,
          priority: "media",
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("updateIncident", () => {
    it("should update incident fields", async () => {
      const result = await updateIncident("inc-uuid-1", {
        title: "Título actualizado",
        priority: "critica",
      });

      expect(result.success).toBe(true);
      expect(mockTxUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Título actualizado",
          priority: "critica",
        })
      );
    });

    it("should log updated fields in event log", async () => {
      await updateIncident("inc-uuid-1", {
        title: "Nuevo título",
        description: "Nueva descripción",
      });

      expect(mockTxInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "incident",
          action: "updated",
          details: { fields: expect.arrayContaining(["title", "description"]) },
        })
      );
    });

    it("should accept empty update", async () => {
      const result = await updateIncident("inc-uuid-1", {});
      expect(result.success).toBe(true);
    });
  });

  describe("transitionIncident", () => {
    it("should transition from nuevo to en_gestion", async () => {
      const result = await transitionIncident({
        incidentId: VALID_UUID,
        toStatus: "en_gestion",
      });

      expect(result.success).toBe(true);
      expect(mockTxUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "en_gestion",
          stateChangedAt: expect.any(Date),
        })
      );
    });

    it("should log transition with comment in event log", async () => {
      await transitionIncident({
        incidentId: VALID_UUID,
        toStatus: "en_gestion",
        comment: "Iniciando gestion del equipo",
      });

      expect(mockTxInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "transition",
          fromState: "nuevo",
          toState: "en_gestion",
          details: { comment: "Iniciando gestion del equipo" },
        })
      );
    });

    it("should reject invalid input (missing incidentId)", async () => {
      const result = await transitionIncident({
        toStatus: "en_gestion",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Datos inválidos");
      }
    });
  });

  describe("fetchUsersForSelect", () => {
    it("should return user list for select", async () => {
      const result = await fetchUsersForSelect();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("fetchIncidentsForSelect", () => {
    it("should return incidents for select", async () => {
      const result = await fetchIncidentsForSelect();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
