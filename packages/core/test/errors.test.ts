import { describe, expect, it } from "vitest";
import { BudgetExhaustedError } from "../src/errors.js";

describe("BudgetExhaustedError", () => {
	it("creates error with correct properties", () => {
		const err = new BudgetExhaustedError({
			scope: "user",
			scopeId: "u1",
			spent: 25.5,
			limit: 25.0,
			window: "daily",
			resetAt: new Date("2025-01-02T00:00:00Z"),
		});

		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe("BudgetExhaustedError");
		expect(err.scope).toBe("user");
		expect(err.scopeId).toBe("u1");
		expect(err.spent).toBe(25.5);
		expect(err.limit).toBe(25.0);
		expect(err.window).toBe("daily");
		expect(err.resetAt).toEqual(new Date("2025-01-02T00:00:00Z"));
		expect(err.message).toContain("$25.50");
		expect(err.message).toContain("$25.00");
		expect(err.message).toContain("daily");
	});

	it("works without resetAt for total window", () => {
		const err = new BudgetExhaustedError({
			scope: "task",
			scopeId: "t1",
			spent: 50.0,
			limit: 50.0,
			window: "total",
		});

		expect(err.resetAt).toBeUndefined();
		expect(err.scope).toBe("task");
	});
});
