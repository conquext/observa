#!/usr/bin/env node
import { program } from 'commander';
import { exportDashboards, importDashboards } from './commands/dashboards.js';

program.name('observatory').description('AI Token Observatory CLI').version('0.1.0');

const dashboards = program.command('dashboards').description('Manage Grafana dashboards');

dashboards
  .command('export')
  .description('Export dashboard JSON files to a directory')
  .requiredOption('--backend <backend>', 'Storage backend (loki, pg, clickhouse)')
  .requiredOption('--outdir <dir>', 'Output directory')
  .action(async (opts) => {
    await exportDashboards(opts.backend, opts.outdir);
  });

dashboards
  .command('import')
  .description('Import dashboards into Grafana via API')
  .requiredOption('--backend <backend>', 'Storage backend (loki, pg, clickhouse)')
  .requiredOption('--grafana-url <url>', 'Grafana URL')
  .requiredOption('--api-key <key>', 'Grafana API key')
  .action(async (opts) => {
    await importDashboards(opts.backend, opts.grafanaUrl, opts.apiKey);
  });

program.parse();
