import { describe, expect, it } from "vitest";
import { PricingEngine } from "../src/pricing.js";
import type { PricingTable, UsageEventInput } from "../src/types.js";

describe("PricingEngine", () => {
	const engine = new PricingEngine("builtin");

	const baseEvent: UsageEventInput = {
		model: "gpt-4o",
		provider: "openai",
		input_tokens: 1_000_000,
		output_tokens: 1_000_000,
		latency_ms: 1000,
		status: "success",
	};

	describe("calculateCost", () => {
		it("calculates cost for known model", () => {
			const cost = engine.calculateCost(baseEvent);
			// 1M input * $2.50/M + 1M output * $10.00/M = $12.50
			expect(cost).toBeCloseTo(12.5);
		});

		it("returns 0 for unknown model", () => {
			const event = { ...baseEvent, model: "unknown-model" };
			const cost = engine.calculateCost(event);
			expect(cost).toBe(0);
		});

		it("handles cache read tokens at discounted rate", () => {
			const event: UsageEventInput = {
				...baseEvent,
				model: "claude-sonnet-4-20250514",
				provider: "anthropic",
				input_tokens: 1_000_000,
				output_tokens: 500_000,
				cache_read_tokens: 400_000,
			};
			const cost = engine.calculateCost(event);
			// Standard input: (1M - 400K) = 600K * $3.00/M = $1.80
			// Cache read: 400K * $0.30/M = $0.12
			// Output: 500K * $15.00/M = $7.50
			// Total: $9.42
			expect(cost).toBeCloseTo(9.42);
		});

		it("handles cache write tokens", () => {
			const event: UsageEventInput = {
				...baseEvent,
				model: "claude-sonnet-4-20250514",
				provider: "anthropic",
				input_tokens: 1_000_000,
				output_tokens: 0,
				cache_write_tokens: 1_000_000,
			};
			const cost = engine.calculateCost(event);
			// Standard input: 1M * $3.00/M = $3.00
			// Cache write: 1M * $3.75/M = $3.75
			// Output: 0
			// Total: $6.75
			expect(cost).toBeCloseTo(6.75);
		});

		it("resolves model by prefix match", () => {
			const event = { ...baseEvent, model: "gpt-4o-2024-08-06" };
			const cost = engine.calculateCost(event);
			expect(cost).toBeCloseTo(12.5);
		});

		it("uses exact match over prefix match", () => {
			const event = { ...baseEvent, model: "gpt-4o-mini" };
			const cost = engine.calculateCost(event);
			// gpt-4o-mini: 1M * $0.15/M + 1M * $0.60/M = $0.75
			expect(cost).toBeCloseTo(0.75);
		});
	});

	describe("isPricingMiss", () => {
		it("returns false for known model", () => {
			expect(engine.isPricingMiss("gpt-4o")).toBe(false);
		});

		it("returns true for unknown model", () => {
			expect(engine.isPricingMiss("unknown-model")).toBe(true);
		});

		it("returns false for prefix matched model", () => {
			expect(engine.isPricingMiss("gpt-4o-2024-08-06")).toBe(false);
		});
	});

	describe("resolve", () => {
		it("loads builtin pricing table", () => {
			const table = PricingEngine.resolve("builtin");
			expect(table.models["gpt-4o"]).toBeDefined();
			expect(table.updatedAt).toBeDefined();
		});

		it("accepts custom pricing table", () => {
			const custom: PricingTable = {
				updatedAt: "2025-01-01",
				models: {
					"custom-model": {
						provider: "custom",
						input_per_million: 1,
						output_per_million: 2,
					},
				},
			};
			const table = PricingEngine.resolve(custom);
			expect(table.models["custom-model"]).toBeDefined();
		});

		it("merges overrides with builtin", () => {
			const table = PricingEngine.resolve({
				base: "builtin",
				overrides: {
					"gpt-4o": {
						provider: "openai",
						input_per_million: 2.0,
						output_per_million: 8.0,
					},
					"my-model": {
						provider: "custom",
						input_per_million: 5.0,
						output_per_million: 15.0,
					},
				},
			});
			expect(table.models["gpt-4o"].input_per_million).toBe(2.0);
			expect(table.models["my-model"]).toBeDefined();
			expect(table.models["claude-sonnet-4-20250514"]).toBeDefined();
		});
	});
});
