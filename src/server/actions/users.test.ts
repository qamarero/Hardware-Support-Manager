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

// Cola de resultados para select(). Cada llamada consume uno; por defecto [].
// Hace falta desde que deleteUser consulta el usuario y cuenta administradores
// antes de borrar.
const sel = vi.hoisted(() => ({ cola: [] as unknown[][] }));

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
              limit: () => sel.cola.shift() ?? [],
              then: (r: (v: unknown) => unknown) => r(sel.cola.shift() ?? []),
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
    sel.cola.length = 0;
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
      sel.cola.push([{ role: "technician" }]);
      const result = await deleteUser("other-user-id");

      expect(result.success).toBe(true);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
        })
      );
    });

    it("rechaza borrar al ultimo administrador activo", async () => {
      sel.cola.push([{ role: "admin" }]); // el usuario a borrar
      sel.cola.push([{ n: 1 }]);          // y no queda ningun otro
      const result = await deleteUser("other-admin-id");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toContain("único administrador");
      expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it("permite borrar un admin si queda otro", async () => {
      sel.cola.push([{ role: "admin" }]);
      sel.cola.push([{ n: 3 }]);
      const result = await deleteUser("other-admin-id");

      expect(result.success).toBe(true);
    });

    it("rechaza un usuario que no existe", async () => {
      const result = await deleteUser("fantasma");
      expect(result.success).toBe(false);
      expect(mockUpdateSet).not.toHaveBeenCalled();
    });
  });
});
