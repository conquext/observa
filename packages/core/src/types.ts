export interface UserContext {
	id: string;
	name?: string;
	email?: string;
	team?: string;
	plan?: string;
}

export interface TaskContext {
	id: string;
	title?: string;
	type?: string;
	priority?: "low" | "medium" | "high" | "critical";
}

export interface SessionContext {
	id: string;
	conversationId?: string;
	parentCallId?: string;
}

export interface ObservabilityContext {
	user?: UserContext;
	task?: TaskContext;
	session?: SessionContext;
	labels?: Record<string, string>;
}

export interface UsageEventInput {
	model: string;
	provider: string;
	requested_model?: string;
	input_tokens: number;
	output_tokens: number;
	total_tokens?: number;
	cost?: number;
	latency_ms: number;
	status: "success" | "error";
	error?: string;
	streaming?: boolean;
	time_to_first_token_ms?: number;
	cache_read_tokens?: number;
	cache_write_tokens?: number;
	context?: ObservabilityContext;
}

export interface UsageEvent extends UsageEventInput {
	id: string;
	timestamp: Date;
	total_tokens: number;
	cost: number;
	pricing_miss?: boolean;
}

export interface ExtractedUsage {
	model: string;
	input_tokens: number;
	output_tokens: number;
	cache_read_tokens?: number;
	cache_write_tokens?: number;
}

export interface TrackedStream<T> extends AsyncIterable<T> {
	getUsage(): Promise<ExtractedUsage>;
}

export interface ProviderAdapter {
	name: string;
	extractUsage(response: unknown): ExtractedUsage;
	extractStreamUsage(stream: AsyncIterable<unknown>): TrackedStream<unknown>;
	instrumentedMethods: string[];
}

export interface ModelPricing {
	provider: string;
	input_per_million: number;
	output_per_million: number;
	cache_read_per_million?: number;
	cache_write_per_million?: number;
}

export interface PricingTable {
	models: Record<string, ModelPricing>;
	updatedAt: string;
}

export type PricingConfig =
	| "builtin"
	| PricingTable
	| { base: "builtin"; overrides: Record<string, ModelPricing> };

export interface BatchConfig {
	maxSize: number;
	flushInterval: number;
}

export type BudgetWindow = "hourly" | "daily" | "monthly" | "total";

export interface BudgetLimits {
	hourly?: number;
	daily?: number;
	monthly?: number;
	total?: number;
}

export interface BudgetConfig {
	perUser?: BudgetLimits;
	perTeam?: BudgetLimits;
	perTask?: BudgetLimits;
	enforcement: "hard" | "soft" | "downgrade";
	downgrades?: Record<string, string>;
	downgradeThreshold?: number;
}

export interface CostThresholdCallback {
	threshold: number;
	handler: (event: UsageEvent) => void;
}

export interface BudgetCallback {
	hourly?: number;
	daily?: number;
	monthly?: number;
	total?: number;
	handler: (scopeId: string, spent: number, limit: number, window: BudgetWindow) => void;
}

export interface ErrorSpikeCallback {
	threshold: number;
	window: string;
	handler: (model: string, errorRate: number) => void;
}

export interface CallbackConfig {
	costThreshold?: CostThresholdCallback;
	userBudget?: BudgetCallback;
	taskBudget?: BudgetCallback;
	errorSpike?: ErrorSpikeCallback;
	event?: (event: UsageEvent) => void;
}

export interface TrackOptions {
	provider: ProviderAdapter;
	context?: ObservabilityContext;
}

export interface MiddlewareOptions {
	extractContext: (req: unknown) => ObservabilityContext;
}

export interface ObservatoryConfig {
	backend: StorageBackend;
	pricing?: PricingConfig;
	budgets?: BudgetConfig;
	on?: CallbackConfig;
	disabled?: boolean;
	defaultContext?: ObservabilityContext;
	batching?: Partial<BatchConfig>;
}

export type AggregateFunction = "sum" | "count" | "avg" | "p50" | "p95" | "p99";
export type AggregateField =
	| "cost"
	| "input_tokens"
	| "output_tokens"
	| "total_tokens"
	| "latency_ms";
export type GroupByField = "model" | "provider" | "user" | "task" | "team";
export type QueryInterval = "1m" | "5m" | "1h" | "1d";

export interface UsageQuery {
	user?: string;
	task?: string;
	session?: string;
	model?: string;
	provider?: string;
	labels?: Record<string, string>;
	from: Date;
	to: Date;
	aggregate?: {
		fn: AggregateFunction;
		field: AggregateField;
		groupBy?: GroupByField[];
		interval?: QueryInterval;
	};
}

export interface StorageBackend {
	write(events: UsageEvent[]): Promise<void>;
	query(query: UsageQuery): Promise<UsageEvent[]>;
	close(): Promise<void>;
}
