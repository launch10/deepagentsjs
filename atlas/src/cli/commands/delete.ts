import { Command } from 'commander';
import { SDKClient } from '../../sdk/index.js';
import { createMockContext, cleanupMockContext } from '../utils/context.js';

export const deleteCommand = new Command('delete')
  .description('Delete data from KV store')
  .addCommand(
    new Command('account')
      .description('Delete account data')
      .argument('<id>', 'Account ID')
      .option('--force', 'Skip confirmation')
      .action(async (id, options) => {
        try {
          if (!options.force) {
            console.log(`⚠️  This will delete account ${id}. Use --force to confirm.`);
            await cleanupMockContext();
            process.exit(0);
          }
          
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.account.delete(id);
          
          if (!result.success) {
            throw new Error(result.error || 'Delete failed');
          }
          console.log(`✅ Account ${id} deleted successfully`);
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error deleting account:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('website')
      .description('Delete website data')
      .argument('<id>', 'Website ID')
      .option('--force', 'Skip confirmation')
      .action(async (id, options) => {
        try {
          if (!options.force) {
            console.log(`⚠️  This will delete website ${id}. Use --force to confirm.`);
            await cleanupMockContext();
            process.exit(0);
          }
          
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.website.delete(id);
          
          if (!result.success) {
            throw new Error(result.error || 'Delete failed');
          }
          console.log(`✅ Website ${id} deleted successfully`);
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error deleting website:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('plan')
      .description('Delete plan data')
      .argument('<id>', 'Plan ID')
      .option('--force', 'Skip confirmation')
      .action(async (id, options) => {
        try {
          if (!options.force) {
            console.log(`⚠️  This will delete plan ${id}. Use --force to confirm.`);
            await cleanupMockContext();
            process.exit(0);
          }
          
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.plan.delete(id);
          
          if (!result.success) {
            throw new Error(result.error || 'Delete failed');
          }
          console.log(`✅ Plan ${id} deleted successfully`);
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error deleting plan:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('domain')
      .description('Delete domain data')
      .argument('<id>', 'Domain ID')
      .option('--force', 'Skip confirmation')
      .action(async (id, options) => {
        try {
          if (!options.force) {
            console.log(`⚠️  Are you sure you want to delete domain ${id}?`);
            console.log('Use --force to skip confirmation');
            process.exit(1);
          }
          
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.domain.delete(id);
          
          if (!result.success) {
            throw new Error(result.error || 'Delete failed');
          }
          console.log(`✅ Domain ${id} deleted successfully`);
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error deleting domain:', error);
          await cleanupMockContext();
          process.exit(1);
        }
      })
  );