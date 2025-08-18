#!/usr/bin/env node

import { Command } from 'commander';
import { setCommand } from './commands/set.js';
import { getCommand } from './commands/get.js';
import { deleteCommand } from './commands/delete.js';
import { listCommand } from './commands/list.js';

const program = new Command();

program
  .name('lps-cli')
  .description('Landing Page Server CLI - Internal tool for managing KV data')
  .version('1.0.0');

program.addCommand(setCommand);
program.addCommand(getCommand);
program.addCommand(deleteCommand);
program.addCommand(listCommand);

program.parse(process.argv);