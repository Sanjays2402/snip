#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import fs from 'fs';
import path from 'path';
import { parse as csvParse } from 'csv-parse/sync';

const CONFIG_PATH = path.join(process.env.HOME || '~', '.sniprc');

interface SnipConfig {
  apiUrl: string;
  apiKey: string;
}

function loadConfig(): SnipConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as SnipConfig;
  } catch {
    console.error(chalk.red('Not configured. Run: snip config --api-url <url> --api-key <key>'));
    process.exit(1);
  }
}

function saveConfig(cfg: SnipConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

interface ApiErrorBody {
  error?: string;
  code?: string;
}

async function apiRequest(
  method: string,
  endpoint: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const cfg = loadConfig();
  const url = `${cfg.apiUrl}${endpoint}`;

  const headers: Record<string, string> = {
    'x-api-key': cfg.apiKey,
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(errBody.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    return res.text();
  }
  return res.json();
}

interface LinkResponse {
  id: string;
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  tags: string[];
  clickCount: number;
  isActive: boolean;
  createdAt: string;
}

interface LinkListResponse {
  links: LinkResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface LinkDetailResponse extends LinkResponse {
  totalClicks: number;
  title: string | null;
  expiresAt: string | null;
  maxClicks: number | null;
  isPermanent: boolean;
}

interface CsvImportRow {
  original_url: string;
  custom_slug?: string;
  tags?: string;
  expires_at?: string;
}

const program = new Command();

program
  .name('snip')
  .description('CLI tool for the Snip URL shortener')
  .version('1.0.0');

// Config command
program
  .command('config')
  .description('Configure API URL and API key')
  .requiredOption('--api-url <url>', 'Snip API base URL')
  .requiredOption('--api-key <key>', 'API key')
  .action((opts: { apiUrl: string; apiKey: string }) => {
    saveConfig({ apiUrl: opts.apiUrl, apiKey: opts.apiKey });
    console.log(chalk.green('✓ Configuration saved to ~/.sniprc'));
  });

// Create command
program
  .command('create')
  .description('Create a short link')
  .argument('<url>', 'URL to shorten')
  .option('-s, --slug <slug>', 'Custom slug')
  .option('-p, --password <password>', 'Password protect the link')
  .option('-e, --expires <datetime>', 'Expiration date (ISO 8601)')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .action(async (url: string, opts: { slug?: string; password?: string; expires?: string; tags?: string }) => {
    try {
      const body: Record<string, unknown> = { url };
      if (opts.slug) body.customSlug = opts.slug;
      if (opts.password) body.password = opts.password;
      if (opts.expires) body.expiresAt = opts.expires;
      if (opts.tags) body.tags = opts.tags.split(',').map((t) => t.trim());

      const link = (await apiRequest('POST', '/api/links', body)) as LinkResponse;
      console.log(chalk.green('✓ Link created'));
      console.log(`  ${chalk.bold('Short URL:')} ${chalk.cyan(link.shortUrl)}`);
      console.log(`  ${chalk.bold('Code:')}      ${link.shortCode}`);
      console.log(`  ${chalk.bold('ID:')}        ${link.id}`);
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List your links')
  .option('-l, --limit <n>', 'Number of links', '20')
  .option('-p, --page <n>', 'Page number', '1')
  .option('-t, --tag <tag>', 'Filter by tag')
  .action(async (opts: { limit: string; page: string; tag?: string }) => {
    try {
      const params = new URLSearchParams({
        page: opts.page,
        limit: opts.limit,
      });
      if (opts.tag) params.set('tag', opts.tag);

      const data = (await apiRequest('GET', `/api/links?${params.toString()}`)) as LinkListResponse;

      if (data.links.length === 0) {
        console.log(chalk.yellow('No links found.'));
        return;
      }

      const table = new Table({
        head: [
          chalk.bold('Short Code'),
          chalk.bold('Original URL'),
          chalk.bold('Clicks'),
          chalk.bold('Tags'),
          chalk.bold('Active'),
        ],
        colWidths: [15, 45, 10, 20, 8],
        wordWrap: true,
      });

      for (const link of data.links) {
        table.push([
          chalk.cyan(link.shortCode),
          link.originalUrl.length > 42 ? link.originalUrl.slice(0, 42) + '...' : link.originalUrl,
          String(link.clickCount),
          link.tags.join(', ') || '-',
          link.isActive ? chalk.green('✓') : chalk.red('✗'),
        ]);
      }

      console.log(table.toString());
      console.log(
        chalk.dim(
          `Page ${data.pagination.page}/${data.pagination.totalPages} (${data.pagination.total} total)`,
        ),
      );
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show click stats for a link')
  .argument('<short_code>', 'Short code of the link')
  .action(async (shortCode: string) => {
    try {
      // First find the link by listing and filtering
      const data = (await apiRequest('GET', `/api/links?limit=100`)) as LinkListResponse;
      const link = data.links.find((l) => l.shortCode === shortCode);

      if (!link) {
        console.error(chalk.red(`Link with code "${shortCode}" not found.`));
        process.exit(1);
      }

      const detail = (await apiRequest('GET', `/api/links/${link.id}`)) as LinkDetailResponse;

      console.log(chalk.bold.cyan(`\n  Stats for /${shortCode}\n`));

      const table = new Table({
        style: { head: [], border: [] },
      });

      table.push(
        [chalk.bold('Short URL'), detail.shortUrl],
        [chalk.bold('Original URL'), detail.originalUrl],
        [chalk.bold('Total Clicks'), String(detail.totalClicks)],
        [chalk.bold('Title'), detail.title || '-'],
        [chalk.bold('Tags'), detail.tags.join(', ') || '-'],
        [chalk.bold('Active'), detail.isActive ? chalk.green('Yes') : chalk.red('No')],
        [chalk.bold('Permanent'), detail.isPermanent ? 'Yes' : 'No'],
        [chalk.bold('Expires'), detail.expiresAt ? new Date(detail.expiresAt).toLocaleString() : 'Never'],
        [chalk.bold('Max Clicks'), detail.maxClicks ? String(detail.maxClicks) : 'Unlimited'],
        [chalk.bold('Created'), new Date(detail.createdAt).toLocaleString()],
      );

      console.log(table.toString());
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Delete command
program
  .command('delete')
  .description('Delete a link')
  .argument('<short_code>', 'Short code of the link')
  .action(async (shortCode: string) => {
    try {
      const data = (await apiRequest('GET', `/api/links?limit=100`)) as LinkListResponse;
      const link = data.links.find((l) => l.shortCode === shortCode);

      if (!link) {
        console.error(chalk.red(`Link with code "${shortCode}" not found.`));
        process.exit(1);
      }

      await apiRequest('DELETE', `/api/links/${link.id}`);
      console.log(chalk.green(`✓ Link /${shortCode} deleted.`));
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Bulk import command
program
  .command('bulk')
  .description('Bulk import links from CSV')
  .argument('<csv_file>', 'Path to CSV file')
  .action(async (csvFile: string) => {
    try {
      const raw = fs.readFileSync(csvFile, 'utf-8');
      const records = csvParse(raw, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as CsvImportRow[];

      console.log(chalk.dim(`Found ${records.length} rows in CSV...\n`));

      let success = 0;
      let failed = 0;

      for (const row of records) {
        try {
          const body: Record<string, unknown> = { url: row.original_url };
          if (row.custom_slug) body.customSlug = row.custom_slug;
          if (row.tags) body.tags = row.tags.split(';').map((t) => t.trim()).filter(Boolean);
          if (row.expires_at) body.expiresAt = row.expires_at;

          const link = (await apiRequest('POST', '/api/links', body)) as LinkResponse;
          console.log(chalk.green(`  ✓ ${row.original_url} → ${link.shortUrl}`));
          success++;
        } catch (err) {
          console.log(chalk.red(`  ✗ ${row.original_url}: ${(err as Error).message}`));
          failed++;
        }
      }

      console.log(`\n${chalk.green(`${success} imported`)}, ${chalk.red(`${failed} failed`)}`);
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

program.parse();
