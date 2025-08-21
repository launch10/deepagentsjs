import { Command } from 'commander';
import { SDKClient } from '../../sdk/index.js';
import type { UserType, WebsiteType, PlanType } from '../../types.js';
import { createMockContext, cleanupMockContext } from '../utils/context.js';

export const setCommand = new Command('set')
  .description('Set data in KV store')
  .addCommand(
    new Command('user')
      .description('Set user data')
      .requiredOption('-i, --id <id>', 'User ID')
      .requiredOption('-o, --org-id <orgId>', 'Organization ID')
      .requiredOption('-p, --plan-id <planId>', 'Plan ID')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const data: UserType = {
            id: options.id,
            orgId: options.orgId,
            planId: options.planId
          };
          
          const result = await client.user.set(options.id, data);
          
          if (result.success) {
            console.log(`✅ User ${options.id} saved successfully`);
          } else {
            console.error(`❌ Error saving user: ${result.error}`);
            process.exit(1);
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
      .description('Set website data')
      .requiredOption('-i, --id <id>', 'Website ID')
      .requiredOption('-u, --url <url>', 'Website URL')
      .requiredOption('-t, --user-id <userId>', 'User ID')
      .option('-l, --live <live>', 'Live deploy SHA', 'ABCD')
      .option('-p, --preview <preview>', 'Preview deploy SHA', 'EFGH')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const data: WebsiteType = {
            id: options.id,
            url: options.url,
            userId: options.userId,
            live: options.live,
            preview: options.preview
          };
          
          const result = await client.website.set(options.id, data);
          
          if (result.success) {
            console.log(`✅ Website ${options.id} saved successfully`);
          } else {
            console.error(`❌ Error saving website: ${result.error}`);
            process.exit(1);
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
      .description('Set plan data')
      .requiredOption('-i, --id <id>', 'Plan ID')
      .requiredOption('-n, --name <name>', 'Plan name')
      .requiredOption('-l, --limit <limit>', 'Usage limit', parseInt)
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const data: PlanType = {
            id: options.id,
            name: options.name,
            usageLimit: options.limit
          };
          
          const result = await client.plan.set(options.id, data);
          
          if (result.success) {
            console.log(`✅ Plan ${options.id} saved successfully`);
          } else {
            console.error(`❌ Error saving plan: ${result.error}`);
            process.exit(1);
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