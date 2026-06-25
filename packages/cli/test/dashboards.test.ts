import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportDashboards } from '../src/commands/dashboards.js';

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

describe('exportDashboards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export dashboard JSON files to output directory', async () => {
    const { readdir, readFile, writeFile, mkdir } = await import('node:fs/promises');

    // Mock readdir to return sample dashboard files
    vi.mocked(readdir).mockResolvedValue([
      'overview.json',
      'tokens.json',
      'costs.json',
      'README.md', // Should be filtered out
    ] as any);

    // Mock readFile to return sample dashboard content
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ dashboard: 'mock' }));

    // Mock writeFile
    vi.mocked(writeFile).mockResolvedValue(undefined);

    // Mock mkdir
    vi.mocked(mkdir).mockResolvedValue(undefined);

    // Call the export function
    await exportDashboards('loki', './output');

    // Verify mkdir was called with correct arguments
    expect(mkdir).toHaveBeenCalledWith('./output', { recursive: true });

    // Verify only JSON files were processed (3 files, not 4)
    expect(writeFile).toHaveBeenCalledTimes(3);

    // Verify writeFile was called with correct paths
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('overview.json'),
      expect.any(String)
    );
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('tokens.json'),
      expect.any(String)
    );
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('costs.json'),
      expect.any(String)
    );
  });
});
