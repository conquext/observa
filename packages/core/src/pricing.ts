import builtinPricing from "./pricing-table.json" with { type: "json" };
import type { ModelPricing, PricingConfig, PricingTable, UsageEventInput } from "./types.js";

export class PricingEngine {
	private readonly table: PricingTable;
	private readonly sortedModelKeys: string[];

	constructor(config: PricingConfig) {
		this.table = PricingEngine.resolve(config);
		// Sort by length descending so longer (more specific) keys match first
		this.sortedModelKeys = Object.keys(this.table.models).sort((a, b) => b.length - a.length);
	}

	static resolve(config: PricingConfig): PricingTable {
		if (config === "builtin") {
			return builtinPricing as PricingTable;
		}
		if ("updatedAt" in config && "models" in config) {
			return config;
		}
		// { base: 'builtin', overrides: {...} }
		const base = builtinPricing as PricingTable;
		return {
			updatedAt: base.updatedAt,
			models: { ...base.models, ...config.overrides },
		};
	}

	calculateCost(event: UsageEventInput): number {
		const pricing = this.findModel(event.model);
		if (!pricing) return 0;

		let cost = 0;

		const standardInput = event.input_tokens - (event.cache_read_tokens ?? 0);
		cost += (standardInput / 1_000_000) * pricing.input_per_million;

		if (event.cache_read_tokens && pricing.cache_read_per_million) {
			cost += (event.cache_read_tokens / 1_000_000) * pricing.cache_read_per_million;
		}

		if (event.cache_write_tokens && pricing.cache_write_per_million) {
			cost += (event.cache_write_tokens / 1_000_000) * pricing.cache_write_per_million;
		}

		cost += (event.output_tokens / 1_000_000) * pricing.output_per_million;

		return cost;
	}

	isPricingMiss(model: string): boolean {
		return this.findModel(model) === undefined;
	}

	private findModel(model: string): ModelPricing | undefined {
		// Exact match first
		if (this.table.models[model]) {
			return this.table.models[model];
		}
		// Prefix match — find the longest key that the model starts with
		for (const key of this.sortedModelKeys) {
			if (model.startsWith(key)) {
				return this.table.models[key];
			}
		}
		return undefined;
	}
}
