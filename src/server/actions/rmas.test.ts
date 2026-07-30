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
  revalidateTag: vi.fn(),
}));

// Mock next/server `after` (sync a Intercom fire-and-forget; sin request scope en tests)
vi.mock("next/server", () => ({
  after: vi.fn(),
}));

// Mock id generator
vi.mock("@/lib/utils/id-generator", () => ({
  generateSequentialId: vi.fn().mockResolvedValue("RMA-2026-00001"),
}));

// DB mock setup
const mockTxInsertValues = vi.fn();
const mockTxInsertReturning = vi.fn();
const mockTxUpdateSet = vi.fn();
const mockTxUpdateWhere = vi.fn();
const mockTxUpdateReturning = vi.fn();
const mockTxSelectWhere = vi.fn();
const mockTxSelectLimit = vi.fn();
let mockCurrentRmaStatus = "borrador";

function createMockTx() {
  return {
    insert: () => ({
      values: (data: unknown) => {
        mockTxInsertValues(data);
        return {
          returning: (cols: unknown) => {
            mockTxInsertReturning(cols);
            return [{ id: "rma-uuid-1" }];
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
                return [{ id: "rma-uuid-1" }];
              },
            };
          },
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          mockTxSelectWhere(condition);
          return {
            for: () => ({
              limit: () => {
                mockTxSelectLimit();
                return [{ status: mockCurrentRmaStatus }];
              },
            }),
            limit: () => {
              mockTxSelectLimit();
              return [{ name: "Cliente Mock" }];
            },
          };
        },
      }),
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
          orderBy: () => [],
          limit: () => [],
        }),
      }),
    }),
  },
}));

// Mock queries
vi.mock("@/server/queries/rmas", () => ({
  getRmas: vi.fn().mockResolvedValue({
    data: [],
    totalCount: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  }),
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
  };
});

const { createRma, updateRma, transitionRma, fetchProvidersForSelect } = await import("./rmas");

const VALID_PROVIDER_UUID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const VALID_INCIDENT_UUID = "b1ffcd00-0d1c-4ef9-bb7e-7cc0ce491b22";
const VALID_RMA_UUID = "c2aade11-1e2d-4fa0-aa8f-8dd1df502c33";

describe("Server Actions: RMAs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentRmaStatus = "borrador";
  });

  describe("createRma", () => {
    it("should create RMA with valid data", async () => {
      const result = await createRma({
        providerId: VALID_PROVIDER_UUID,
        clientName: "Restaurante La Plaza",
        deviceType: "tpv",
        deviceBrand: "Epson",
        deviceModel: "TM-T88VI",
        deviceSerialNumber: "SN-98765",
        notes: "TPV con fallo de impresora térmica",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("rma-uuid-1");
      }
      expect(mockTxInsertValues).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          rmaNumber: "RMA-2026-00001",
          providerId: VALID_PROVIDER_UUID,
          deviceType: "tpv",
        })
      );
      expect(mockTxInsertValues).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          entityType: "rma",
          action: "created",
          toState: "borrador",
        })
      );
    });

    it("should create with minimal required fields (only providerId)", async () => {
      const result = await createRma({
        providerId: VALID_PROVIDER_UUID,
      });

      expect(result.success).toBe(true);
      expect(mockTxInsertValues).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          providerId: VALID_PROVIDER_UUID,
          clientName: null,
          incidentId: null,
          deviceType: null,
          notes: null,
        })
      );
    });

    it("should convert empty strings to null for homogeneous fields", async () => {
      const result = await createRma({
        providerId: VALID_PROVIDER_UUID,
        clientName: "",
        clientExternalId: "",
        clientIntercomUrl: "",
        deviceType: "",
        deviceBrand: "",
        deviceModel: "",
        deviceSerialNumber: "",
        contactName: "",
        contactPhone: "",
        pickupAddress: "",
        pickupCity: "",
        pickupPostalCode: "",
        notes: "",
        incidentId: "",
      });

      expect(result.success).toBe(true);
      expect(mockTxInsertValues).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          clientName: null,
          clientExternalId: null,
          clientIntercomUrl: null,
          deviceType: null,
          deviceBrand: null,
          deviceModel: null,
          deviceSerialNumber: null,
          contactName: null,
          contactPhone: null,
          pickupAddress: null,
          pickupPostalCode: null,
          pickupCity: null,
          notes: null,
          incidentId: null,
        })
      );
    });

    it("should persist homogeneous contact and pickup fields", async () => {
      const result = await createRma({
        providerId: VALID_PROVIDER_UUID,
        contactName: "María",
        contactPhone: "600111222",
        pickupAddress: "C/ Sol 1",
        pickupCity: "Madrid",
        pickupPostalCode: "28013",
      });

      expect(result.success).toBe(true);
      expect(mockTxInsertValues).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          contactName: "María",
          contactPhone: "600111222",
          pickupAddress: "C/ Sol 1",
          pickupCity: "Madrid",
          pickupPostalCode: "28013",
        })
      );
    });

    it("should reject missing providerId", async () => {
      const result = await createRma({
        clientName: "Test",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Datos inválidos");
      }
    });

    it("should reject invalid providerId (not UUID)", async () => {
      const result = await createRma({
        providerId: "not-a-uuid",
      });

      expect(result.success).toBe(false);
    });

    it("should link to incident when valid UUID provided", async () => {
      const result = await createRma({
        providerId: VALID_PROVIDER_UUID,
        incidentId: VALID_INCIDENT_UUID,
      });

      expect(result.success).toBe(true);
      expect(mockTxInsertValues).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          incidentId: VALID_INCIDENT_UUID,
        })
      );
    });
  });

  describe("updateRma", () => {
    it("should update RMA fields", async () => {
      const result = await updateRma("rma-uuid-1", {
        notes: "Notas actualizadas",
        trackingNumberOutgoing: "TRACK-001",
      });

      expect(result.success).toBe(true);
      expect(mockTxUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: "Notas actualizadas",
          trackingNumberOutgoing: "TRACK-001",
        })
      );
    });

    it("should log updated fields", async () => {
      await updateRma("rma-uuid-1", {
        providerRmaNumber: "RMA-PROV-123",
        trackingNumberReturn: "RETURN-001",
      });

      expect(mockTxInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "rma",
          action: "updated",
          details: { fields: expect.arrayContaining(["providerRmaNumber", "trackingNumberReturn"]) },
        })
      );
    });

    it("should update homogeneous pickup fields", async () => {
      await updateRma("rma-uuid-1", {
        pickupAddress: "Nueva dirección",
        pickupCity: "Barcelona",
        pickupPostalCode: "08001",
      });

      expect(mockTxUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          pickupAddress: "Nueva dirección",
          pickupCity: "Barcelona",
          pickupPostalCode: "08001",
        })
      );
    });
  });

  describe("transitionRma", () => {
    it("should transition borrador -> solicitado", async () => {
      mockCurrentRmaStatus = "borrador";
      const result = await transitionRma({
        rmaId: VALID_RMA_UUID,
        toStatus: "solicitado",
        comment: "Enviando solicitud al proveedor",
      });

      expect(result.success).toBe(true);
      expect(mockTxUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "solicitado",
          stateChangedAt: expect.any(Date),
        })
      );
    });

    it("should reject invalid input (missing rmaId)", async () => {
      const result = await transitionRma({
        toStatus: "solicitado",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Datos inválidos");
      }
    });

    it("should reject invalid status", async () => {
      mockCurrentRmaStatus = "borrador";
      const result = await transitionRma({
        rmaId: VALID_RMA_UUID,
        toStatus: "invalid_status",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("fetchProvidersForSelect", () => {
    it("should return provider list for select", async () => {
      const result = await fetchProvidersForSelect();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
