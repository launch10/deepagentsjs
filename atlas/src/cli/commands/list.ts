import { Command } from 'commander';
import { SDKClient } from '../../sdk/index.js';
import { createMockContext, cleanupMockContext } from '../utils/context.js';

export const listCommand = new Command('list')
  .description('List data from KV store')
  .addCommand(
    new Command('users')
      .description('List all users')
      .option('-l, --limit <limit>', 'Limit number of results', '100')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.user.list(parseInt(options.limit));
          
          if (!result.success) {
            throw new Error(result.error || 'List failed');
          }
          
          const users = result.data || [];
          console.log(`Found ${users.length} users:`);
          console.log(JSON.stringify(users, null, 2));
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error listing users:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('websites')
      .description('List all websites')
      .option('-l, --limit <limit>', 'Limit number of results', '100')
      .option('--user <userId>', 'Filter by user ID')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          if (options.user) {
            const result = await client.website.findByUser(options.user);
            if (!result.success) {
              throw new Error(result.error || 'List failed');
            }
            const websites = result.data || [];
            console.log(`Found ${websites.length} websites for user ${options.user}:`);
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
  );