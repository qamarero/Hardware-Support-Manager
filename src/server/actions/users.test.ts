import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
const mockRequireRole = vi.fn().mockResolvedValue({
  user: { id: "admin-1", name: "Admin", role: "admin" },
});

vi.mock("@/lib/auth/get-session", () => ({
  getRequiredSession: vi.fn().mockResolvedValue({
    user: { id: "admin-1", name: "Admin", role: "admin" },
  }),
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed_password"),
  },
}));

const mockInsertValues = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: (data: unknown) => {
        mockInsertValues(data);
        return {
          returning: () => [{ id: "new-user-id" }],
        };
      },
    }),
    select: () => ({
      from: () => {
        mockSelectFrom();
        return {
          where: (condition: unknown) => {
            mockSelectWhere(condition);
            return {
              limit: () => [],
            };
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
              returning: () => [{ id: "existing-user-id" }],
            };
          },
        };
      },
    }),
  },
}));

// Mock queries
vi.mock("@/server/queries/users", () => ({
  getUsers: vi.fn().mockResolvedValue({
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

const { createUser, updateUser, deleteUser } = await import("./users");

describe("Server Actions: Users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({
      user: { id: "admin-1", name: "Admin", role: "admin" },
    });
  });

  describe("createUser", () => {
    it("should require admin role", async () => {
      await createUser({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
        role: "technician",
      });

      expect(mockRequireRole).toHaveBeenCalledWith("admin");
    });

    it("should create user with hashed password", async () => {
      const result = await createUser({
        name: "Test User",
        email: "newuser@example.com",
        password: "password123",
        role: "technician",
      });

      expect(result.success).toBe(true);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test User",
          email: "newuser@example.com",
          passwordHash: "hashed_password",
          role: "technician",
        })
      );
    });

    it("should reject invalid data (short password)", async () => {
      const result = await createUser({
        name: "Test User",
        email: "test@example.com",
        password: "12345",
        role: "technician",
      });

      expect(result.success).toBe(false);
    });

    it("should reject when requireRole throws", async () => {
      mockRequireRole.mockRejectedValueOnce(new Error("No autorizado"));

      await expect(
        createUser({
          name: "Test",
          email: "test@example.com",
          password: "password123",
          role: "technician",
        })
      ).rejects.toThrow("No autorizado");
    });
  });

  describe("updateUser", () => {
    it("should prevent self-removal of admin role", async () => {
      const result = await updateUser("admin-1", {
        role: "viewer",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("No puedes cambiar tu propio rol");
      }
    });

    it("should allow updating other users' roles", async () => {
      const result = await updateUser("other-user-id", {
        role: "viewer",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("deleteUser", () => {
    it("should prevent self-deletion", async () => {
      const result = await deleteUser("admin-1");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("No puedes eliminarte a ti mismo");
      }
    });

    it("should soft delete other users", async () => {
      const result = await deleteUser("other-user-id");

      expect(result.success).toBe(true);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
        })
      );
    });
  });
});
