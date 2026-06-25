import { describe, expect, it } from "vitest";
import { ObservabilityContextSchema, UsageEventInputSchema } from "../src/schemas.js";

describe("UsageEventInputSchema", () => {
	const validEvent = {
		model: "gpt-4o",
		provider: "openai",
		input_tokens: 1500,
		output_tokens: 300,
		latency_ms: 820,
		status: "success" as const,
	};

	it("accepts a valid minimal event", () => {
		const result = UsageEventInputSchema.parse(validEvent);
		expect(result.model).toBe("gpt-4o");
		expect(result.provider).toBe("openai");
	});

	it("accepts a full event with all optional fields", () => {
		const result = UsageEventInputSchema.parse({
			...validEvent,
			requested_model: "gpt-4",
			total_tokens: 1800,
			cost: 0.025,
			error: undefined,
			streaming: true,
			time_to_first_token_ms: 120,
			cache_read_tokens: 500,
			cache_write_tokens: 200,
			context: {
				user: { id: "u1", name: "Alice", team: "eng" },
				task: { id: "t1", type: "summarize", priority: "high" },
				session: { id: "s1", conversationId: "c1" },
				labels: { env: "production" },
			},
		});
		expect(result.streaming).toBe(true);
		expect(result.context?.user?.id).toBe("u1");
	});

	it("rejects empty model", () => {
		expect(() => UsageEventInputSchema.parse({ ...validEvent, model: "" })).toThrow();
	});

	it("rejects negative token counts", () => {
		expect(() => UsageEventInputSchema.parse({ ...validEvent, input_tokens: -1 })).toThrow();
	});

	it("rejects invalid status", () => {
		expect(() => UsageEventInputSchema.parse({ ...validEvent, status: "timeout" })).toThrow();
	});

	it("rejects invalid priority", () => {
		expect(() =>
			UsageEventInputSchema.parse({
				...validEvent,
				context: { task: { id: "t1", priority: "urgent" } },
			}),
		).toThrow();
	});

	it("rejects invalid email in user context", () => {
		expect(() =>
			ObservabilityContextSchema.parse({
				user: { id: "u1", email: "not-an-email" },
			}),
		).toThrow();
	});
});
