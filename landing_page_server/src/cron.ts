import { Env } from './types';
import { updateFirewallList } from './cloudflare-api';

export async function handleScheduled(controller: ScheduledController, env: Env) {
  console.log('Running daily usage reset cron job...');
  
  // This is a simplified version. In production, you would get the list of active
  // tenants from your main database rather than trying to list all KV keys.
  const list = await env.USAGE_KV.list({ prefix: 'status:' });

  for (const key of list.keys) {
    const tenantId = key.name.split(':')[1];
    const hostname = `${tenantId}`; // This assumes tenantId is the full hostname. Adjust as needed.

    console.log(`Resetting usage for tenant: ${tenantId}`);

    // Remove from the firewall suspension list
    await updateFirewallList(env, hostname, 'remove');
    
    // Delete the usage tracking keys from KV
    await env.USAGE_KV.delete(`count:${tenantId}`);
    await env.USAGE_KV.delete(`status:${tenantId}`);
  }
  
  console.log('Daily usage reset complete.');
}