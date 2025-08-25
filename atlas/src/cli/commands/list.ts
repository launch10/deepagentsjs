import { Command } from 'commander';
import { SDKClient } from '../../sdk/index.js';
import { createMockContext, cleanupMockContext } from '../utils/context.js';

export const listCommand = new Command('list')
  .description('List data from KV store')
  .addCommand(
    new Command('accounts')
      .description('List all accounts')
      .option('-l, --limit <limit>', 'Limit number of results', '100')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.account.list(parseInt(options.limit));
          
          if (!result.success) {
            throw new Error(result.error || 'List failed');
          }
          
          const accounts = result.data || [];
          console.log(`Found ${accounts.length} accounts:`);
          console.log(JSON.stringify(accounts, null, 2));
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error listing accounts:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('websites')
      .description('List all websites')
      .option('-l, --limit <limit>', 'Limit number of results', '100')
      .option('--account <accountId>', 'Filter by account ID')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          if (options.account) {
            const result = await client.website.findByAccount(options.account);
            if (!result.success) {
              throw new Error(result.error || 'List failed');
            }
            const websites = result.data || [];
            console.log(`Found ${websites.length} websites for account ${options.account}:`);
            console.log(JSON.stringify(websites, null, 2));
          } else {
            const result = await client.website.list(parseInt(options.limit));
            if (!result.success) {
              throw new Error(result.error || 'List failed');
            }
            const websites = result.data || [];
            console.log(`Found ${websites.length} websites:`);
            console.log(JSON.stringify(websites, null, 2));
          }
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error listing websites:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('plans')
      .description('List all plans')
      .option('-l, --limit <limit>', 'Limit number of results', '100')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.plan.list(parseInt(options.limit));
          
          if (!result.success) {
            throw new Error(result.error || 'List failed');
          }
          
          const plans = result.data || [];
          console.log(`Found ${plans.length} plans:`);
          console.log(JSON.stringify(plans, null, 2));
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error listing plans:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('domains')
      .description('List domains')
      .option('--limit <number>', 'Limit number of results', '100')
      .option('--website <id>', 'Filter by website ID')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const limit = parseInt(options.limit);
          const result = await client.domain.list(limit, options.website);
          
          if (!result.success) {
            console.error('❌ Error:', result.error);
            await cleanupMockContext();
            process.exit(1);
          }
          
          const domains = result.data || [];
          console.log(`Found ${domains.length} domains:`);
          console.log(JSON.stringify(domains, null, 2));
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error listing domains:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  );