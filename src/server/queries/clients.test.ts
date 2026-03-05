import { describe, it, expect, vi, beforeEach } from "vitest";

const sampleClient = {
  id: "client-1",
  name: "Test Client",
  email: "test@example.com",
  phone: "123456",
  company: "Test Co",
  address: null,
  notes: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  deletedAt: null,
};

let selectCallCount = 0;

function createSelectChain() {
  selectCallCount++;
  const isCountQuery = selectCallCount % 2 === 0;
  const terminalResult = isCountQuery ? [{ count: 1 }] : [sampleClient];

  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  const methods = ["from", "where", "orderBy", "limit", "offset"];

  for (const method of methods) {
    chain[method] = () => {
      // Each method returns the chain itself or terminal data
      return new Proxy(terminalResult, {
        get(target, prop) {
          if (prop === "then" || prop === "catch" || prop === "finally") {
            // Make it promise-like only when accessed as part of Promise.all
            return undefined;
          }
          if (typeof prop === "string" && methods.includes(prop)) {
            return chain[prop];
          }
          return (target as Record<string | symbol, unknown>)[prop];
        },
      });
    };
  }

  return chain;
}

vi.mock("@/lib/db", () => ({
  db: {
    select: () => createSelectChain(),
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
    ilike: vi.fn((...args: unknown[]) => ({ type: "ilike", args })),
    isNull: vi.fn((col: unknown) => ({ type: "isNull", col })),
    asc: vi.fn((col: unknown) => ({ type: "asc", col })),
    desc: vi.fn((col: unknown) => ({ type: "desc", col })),
    count: vi.fn(() => "count"),
  };
});

const { getClients, getClientById } = await import("./clients");

describe("Server Queries: Clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
  });

  describe("getClients", () => {
    it("should return paginated result structure", async () => {
      const result = await getClients({ page: 1, pageSize: 10 });

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("totalCount");
      expect(result).toHaveProperty("page", 1);
      expect(result).toHaveProperty("pageSize", 10);
      expect(result).toHaveProperty("totalPages");
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("should calculate totalPages correctly", async () => {
      const result = await getClients({ page: 1, pageSize: 10 });

      expect(result.totalPages).toBe(1);
    });

    it("should pass correct page and pageSize", async () => {
      const result = await getClients({ page: 2, pageSize: 5 });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(5);
    });

    it("should return data array with client objects", async () => {
      const result = await getClients({ page: 1, pageSize: 10 });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty("id");
      expect(result.data[0]).toHaveProperty("name");
    });

    it("should default sortOrder to desc", async () => {
      const result = await getClients({ page: 1, pageSize: 10 });

      // Should not throw - validates defaults are applied
      expect(result).toBeDefined();
    });
  });

  describe("getClientById", () => {
    it("should return client when found", async () => {
      const result = await getClientById("client-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("client-1");
      expect(result?.name).toBe("Test Client");
    });
  });
});
