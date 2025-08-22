import { Command } from 'commander';
import { SDKClient } from '../../sdk/index.js';
import { createMockContext, cleanupMockContext } from '../utils/context.js';

export const getCommand = new Command('get')
  .description('Get data from KV store')
  .addCommand(
    new Command('user')
      .description('Get user data')
      .argument('<id>', 'User ID')
      .action(async (id) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.user.get(id);
          
          if (result.success && result.data) {
            console.log(JSON.stringify(result.data, null, 2));
          } else {
            console.log(result.error || `User ${id} not found`);
          }
          
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('website')
      .description('Get website data')
      .argument('<id>', 'Website ID')
      .option('--by-url <url>', 'Find by URL instead of ID')
      .action(async (id, options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          if (options.byUrl) {
            const result = await client.website.findByUrl(options.byUrl);
            if (result.success && result.data) {
              console.log(JSON.stringify(result.data, null, 2));
            } else {
              console.log(result.error || 'Website not found');
            }
          } else {
            const result = await client.website.get(id);
            if (result.success && result.data) {
              console.log(JSON.stringify(result.data, null, 2));
            } else {
              console.log(result.error || `Website ${id} not found`);
            }
          }
          
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('plan')
      .description('Get plan data')
      .argument('<id>', 'Plan ID')
      .action(async (id) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.plan.get(id);
          
          if (result.success && result.data) {
            console.log(JSON.stringify(result.data, null, 2));
          } else {
            console.log(result.error || `Plan ${id} not found`);
          }
          
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('domain')
      .description('Get domain data')
      .argument('<id>', 'Domain ID')
      .option('--by-url <url>', 'Find by domain URL instead of ID')
      .action(async (id, options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          if (options.byUrl) {
            const result = await client.domain.findByUrl(options.byUrl);
            if (result.success && result.data) {
              console.log(JSON.stringify(result.data, null, 2));
            } else {
              console.log(result.error || 'Domain not found');
            }
          } else {
            const result = await client.domain.get(id);
            if (result.success && result.data) {
              console.log(JSON.stringify(result.data, null, 2));
            } else {
              console.log(result.error || `Domain ${id} not found`);
            }
          }
          
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  );