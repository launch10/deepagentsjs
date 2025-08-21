import { Command } from 'commander';
import { SDKClient } from '../../sdk/index.js';
import { createMockContext, cleanupMockContext } from '../utils/context.js';

export const deleteCommand = new Command('delete')
  .description('Delete data from KV store')
  .addCommand(
    new Command('user')
      .description('Delete user data')
      .argument('<id>', 'User ID')
      .option('--force', 'Skip confirmation')
      .action(async (id, options) => {
        try {
          if (!options.force) {
            console.log(`⚠️  This will delete user ${id}. Use --force to confirm.`);
            await cleanupMockContext();
            process.exit(0);
          }
          
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.user.delete(id);
          
          if (!result.success) {
            throw new Error(result.error || 'Delete failed');
          }
          console.log(`✅ User ${id} deleted successfully`);
          await cleanupMockContext();
          process.exit(0);
        } catch (error) {
          console.error('❌ Error deleting user:', error);
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
  );