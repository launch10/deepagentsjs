import { Command } from 'commander';
import { SDKClient } from '../../sdk/index.js';
import { createMockContext, cleanupMockContext } from '../utils/context.js';

export const firewallCommand = new Command('firewall')
  .description('Manage tenant firewall settings')
  .addCommand(
    new Command('block')
      .description('Block a tenant')
      .requiredOption('-t, --tenant-id <id>', 'Tenant ID')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.tenant.block(options.tenantId);
          
          if (result.success) {
            console.log(`✅ Tenant ${options.tenantId} blocked successfully`);
          } else {
            console.error(`❌ Error blocking tenant: ${result.error}`);
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
    new Command('unblock')
      .description('Unblock a tenant')
      .requiredOption('-t, --tenant-id <id>', 'Tenant ID')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.tenant.unblock(options.tenantId);
          
          if (result.success) {
            console.log(`✅ Tenant ${options.tenantId} unblocked successfully`);
          } else {
            console.error(`❌ Error unblocking tenant: ${result.error}`);
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
    new Command('reset')
      .description('Reset a tenant (unblock and reset request count)')
      .requiredOption('-t, --tenant-id <id>', 'Tenant ID')
      .action(async (options) => {
        try {
          const context = await createMockContext();
          const client = new SDKClient(context);
          
          const result = await client.tenant.reset(options.tenantId);
          
          if (result.success) {
            console.log(`✅ Tenant ${options.tenantId} reset successfully`);
          } else {
            console.error(`❌ Error resetting tenant: ${result.error}`);
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