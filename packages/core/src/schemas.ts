import { z } from "zod";

export const UserContextSchema = z.object({
	id: z.string().min(1),
	name: z.string().optional(),
	email: z.string().email().optional(),
	team: z.string().optional(),
	plan: z.string().optional(),
});

export const TaskContextSchema = z.object({
	id: z.string().min(1),
	title: z.string().optional(),
	type: z.string().optional(),
	priority: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export const SessionContextSchema = z.object({
	id: z.string().min(1),
	conversationId: z.string().optional(),
	parentCallId: z.string().optional(),
});

export const ObservabilityContextSchema = z.object({
	user: UserContextSchema.optional(),
	task: TaskContextSchema.optional(),
	session: SessionContextSchema.optional(),
	labels: z.record(z.string(), z.string()).optional(),
});

export const UsageEventInputSchema = z.object({
	model: z.string().min(1),
	provider: z.string().min(1),
	requested_model: z.string().optional(),
	input_tokens: z.number().int().nonnegative(),
	output_tokens: z.number().int().nonnegative(),
	total_tokens: z.number().int().nonnegative().optional(),
	cost: z.number().nonnegative().optional(),
	latency_ms: z.number().nonnegative(),
	status: z.enum(["success", "error"]),
	error: z.string().optional(),
	streaming: z.boolean().optional(),
	time_to_first_token_ms: z.number().nonnegative().optional(),
	cache_read_tokens: z.number().int().nonnegative().optional(),
	cache_write_tokens: z.number().int().nonnegative().optional(),
	context: ObservabilityContextSchema.optional(),
});
