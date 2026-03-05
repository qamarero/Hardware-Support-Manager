import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth/get-session", () => ({
  getRequiredSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Admin", role: "admin" },
  }),
  requireRole: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Admin", role: "admin" },
  }),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockInsertValues = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockUpdateReturning = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: (data: unknown) => {
        mockInsertValues(data);
        return {
          returning: () => {
            mockInsertReturning();
            return [{ id: "new-client-id" }];
          },
        };
      },
    }),
    update: () => ({
      set: (data: unknown) => {
        mockUpdateSet(data);
        return {
          where: (condition: unknown) => {
            mockUpdateWhere(condition);
            return {
              returning: () => {
                mockUpdateReturning();
                return [{ id: "existing-client-id" }];
              },
            };
          },
        };
      },
    }),
  },
}));

// Mock queries
vi.mock("@/server/queries/clients", () => ({
  getClients: vi.fn().mockResolvedValue({
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
  };
});

const { createClient, updateClient, deleteClient } = await import("./clients");

describe("Server Actions: Clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createClient", () => {
    it("should create a client with valid data", async () => {
      const result = await createClient({
        name: "Test Client",
        email: "test@example.com",
        phone: "123456",
        company: "Test Co",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("new-client-id");
      }
      expect(mockInsertValues).toHaveBeenCalled();
    });

    it("should reject invalid data (missing name)", async () => {
      const result = await createClient({
        email: "test@example.com",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Datos inválidos");
      }
    });

    it("should reject empty name", async () => {
      const result = await createClient({
        name: "",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("updateClient", () => {
    it("should update a client with valid data", async () => {
      const result = await updateClient("existing-client-id", {
        name: "Updated Client",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("existing-client-id");
      }
    });
  });

  describe("deleteClient", () => {
    it("should soft delete a client", async () => {
      const result = await deleteClient("existing-client-id");

      expect(result.success).toBe(true);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
        })
      );
    });
  });
});
