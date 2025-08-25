import { Command } from 'commander';
import { SDKClient } from '../../sdk/index.js';
import type { AccountType, WebsiteType, PlanType } from '../../types.js';
import { createMockContext, cleanupMockContext } from '../utils/context.js';

export const setCommand = new Command('set')
  .description('Set data in KV store')
  .addCommand(
    new Command('account')
      .description('Set account data')
      .requiredOption('-i, --id <id>', 'Account ID')
      .requiredOption('-o, --org-id <orgId>', 'Organization ID')
      .requiredOption('-p, --plan-id <planId>', 'Plan ID')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const data: AccountType = {
            id: options.id,
            orgId: options.orgId,
            planId: options.planId
          };
          
          const result = await client.account.set(options.id, data);
          
          if (result.success) {
            console.log(`✅ Account ${options.id} saved successfully`);
          } else {
            console.error(`❌ Error saving account: ${result.error}`);
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
      .requiredOption('-t, --account-id <accountId>', 'Account ID')
      .option('-l, --live <live>', 'Live deploy SHA', 'ABCD')
      .option('-p, --preview <preview>', 'Preview deploy SHA', 'EFGH')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const data: WebsiteType = {
            id: options.id,
            url: options.url,
            accountId: options.accountId,
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
  )
  .addCommand(
    new Command('domain')
      .description('Set domain data')
      .option('--id <id>', 'Domain ID (auto-generated if not provided)')
      .requiredOption('--domain <domain>', 'Domain URL')
      .requiredOption('--website-id <websiteId>', 'Website ID')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const domainData = {
            id: options.id || crypto.randomUUID(),
            domain: options.domain,
            websiteId: options.websiteId
          };
          
          const result = await client.domain.set(domainData.id, domainData);
          
          if (result.success) {
            console.log(`✅ Domain ${domainData.id} saved successfully`);
            console.log(JSON.stringify(domainData, null, 2));
          } else {
            console.error(`❌ Error saving domain: ${result.error}`);
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