#!/usr/bin/env node

import { Command } from 'commander';
import { setCommand } from './commands/set.js';
import { getCommand } from './commands/get.js';
import { deleteCommand } from './commands/delete.js';
import { listCommand } from './commands/list.js';
import { firewallCommand } from './commands/firewall.js';

const program = new Command();

program
  .name('lps-cli')
  .description('Landing Page Server CLI - Internal tool for managing KV data')
  .version('1.0.0')
  .option('-c, --config <path>', 'Path to wrangler config file (default: wrangler-admin.toml)')
  .hook('preAction', (thisCommand) => {
    // Store config path for commands to use
    const configPath = thisCommand.opts().config || 'wrangler-admin.toml';
    process.env.WRANGLER_CONFIG_PATH = configPath;
  });

program.addCommand(setCommand);
program.addCommand(getCommand);
program.addCommand(deleteCommand);
program.addCommand(listCommand);
program.addCommand(firewallCommand);

program.parse(process.argv);