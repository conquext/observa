import type { BudgetWindow } from "./types.js";

export class BudgetExhaustedError extends Error {
	readonly scope: "user" | "team" | "task";
	readonly scopeId: string;
	readonly spent: number;
	readonly limit: number;
	readonly window: BudgetWindow;
	readonly resetAt?: Date;

	constructor(params: {
		scope: "user" | "team" | "task";
		scopeId: string;
		spent: number;
		limit: number;
		window: BudgetWindow;
		resetAt?: Date;
	}) {
		super(
			`Budget exhausted for ${params.scope} "${params.scopeId}": ` +
				`$${params.spent.toFixed(2)} spent of $${params.limit.toFixed(2)} ${params.window} limit`,
		);
		this.name = "BudgetExhaustedError";
		this.scope = params.scope;
		this.scopeId = params.scopeId;
		this.spent = params.spent;
		this.limit = params.limit;
		this.window = params.window;
		this.resetAt = params.resetAt;
	}
}
