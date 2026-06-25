import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LokiBackend } from '../src/loki-backend.js';
import type { UsageEvent } from '@conquext/core';

const makeEvent = (overrides: Partial<UsageEvent> = {}): UsageEvent => ({
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  timestamp: new Date('2025-06-01T12:00:00Z'),
  model: 'gpt-4o',
  provider: 'openai',
  input_tokens: 100,
  output_tokens: 50,
  total_tokens: 150,
  cost: 0.001,
  latency_ms: 500,
  status: 'success',
  context: { user: { id: 'u1', team: 'eng' }, task: { id: 't1', type: 'summarize' } },
  ...overrides,
});

describe('LokiBackend', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends events to Loki push API', async () => {
    const backend = new LokiBackend({ url: 'http://loki:3100' });
    await backend.write([makeEvent()]);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://loki:3100/loki/api/v1/push');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(opts.body);
    expect(body.streams).toHaveLength(1);
    expect(body.streams[0].stream.provider).toBe('openai');
    expect(body.streams[0].stream.model).toBe('gpt-4o');
    expect(body.streams[0].stream.status).toBe('success');
    expect(body.streams[0].stream.job).toBe('observatory');
  });

  it('maps low-cardinality fields to labels', async () => {
    const backend = new LokiBackend({ url: 'http://loki:3100' });
    await backend.write([makeEvent()]);

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const labels = body.streams[0].stream;
    expect(labels.provider).toBe('openai');
    expect(labels.model).toBe('gpt-4o');
    expect(labels.status).toBe('success');
    expect(labels.user_id).toBe('u1');
    expect(labels.team).toBe('eng');
    expect(labels.task_type).toBe('summarize');
  });

  it('puts token/cost data in log line JSON', async () => {
    const backend = new LokiBackend({ url: 'http://loki:3100' });
    await backend.write([makeEvent()]);

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const logLine = JSON.parse(body.streams[0].values[0][1]);
    expect(logLine.input_tokens).toBe(100);
    expect(logLine.output_tokens).toBe(50);
    expect(logLine.cost).toBe(0.001);
    expect(logLine.latency_ms).toBe(500);
  });

  it('includes auth header when configured', async () => {
    const backend = new LokiBackend({
      url: 'http://loki:3100',
      auth: { token: 'my-token' },
    });
    await backend.write([makeEvent()]);

    const opts = fetchSpy.mock.calls[0][1];
    expect(opts.headers.Authorization).toBe('Bearer my-token');
  });

  it('includes basic auth when configured', async () => {
    const backend = new LokiBackend({
      url: 'http://loki:3100',
      auth: { username: 'user', password: 'pass' },
    });
    await backend.write([makeEvent()]);

    const opts = fetchSpy.mock.calls[0][1];
    const expected = `Basic ${btoa('user:pass')}`;
    expect(opts.headers.Authorization).toBe(expected);
  });

  it('throws on non-2xx response', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
    const backend = new LokiBackend({ url: 'http://loki:3100' });

    await expect(backend.write([makeEvent()])).rejects.toThrow('Loki push failed: 500');
  });

  it('adds custom static labels', async () => {
    const backend = new LokiBackend({
      url: 'http://loki:3100',
      labels: { env: 'production', service: 'my-api' },
    });
    await backend.write([makeEvent()]);

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const labels = body.streams[0].stream;
    expect(labels.env).toBe('production');
    expect(labels.service).toBe('my-api');
  });
});
