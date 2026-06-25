import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export async function exportDashboards(backend: string, outdir: string): Promise<void> {
  const dashboardsDir = resolve(`node_modules/@observatory/${backend}/dashboards`);
  const files = await readdir(dashboardsDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  await mkdir(outdir, { recursive: true });

  for (const file of jsonFiles) {
    const content = await readFile(join(dashboardsDir, file), 'utf-8');
    await writeFile(join(outdir, file), content);
    console.log(`Exported: ${file}`);
  }

  console.log(`\n${jsonFiles.length} dashboards exported to ${outdir}`);
}

export async function importDashboards(
  backend: string,
  grafanaUrl: string,
  apiKey: string,
): Promise<void> {
  const dashboardsDir = resolve(`node_modules/@observatory/${backend}/dashboards`);
  const files = await readdir(dashboardsDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  for (const file of jsonFiles) {
    const content = await readFile(join(dashboardsDir, file), 'utf-8');
    const dashboard = JSON.parse(content);

    const response = await fetch(`${grafanaUrl}/api/dashboards/db`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        dashboard: { ...dashboard, id: null },
        overwrite: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Failed to import ${file}: ${response.status} ${text}`);
    } else {
      console.log(`Imported: ${file}`);
    }
  }
}
