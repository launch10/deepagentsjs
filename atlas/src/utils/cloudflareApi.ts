import { Env } from '../types';

export async function removeFromFirewallList(env: Env, ids: string[]): Promise<boolean> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/rules/lists/${env.CLOUDFLARE_BLOCKED_DOMAINS_LIST_ID}/items`;
  const options: RequestInit = {
    method: "DELETE",
    headers: {
      'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      "items": ids.map(id => ({ id }))
    }),
  };
    
  try {
    console.log(`Removing ${ids} from Firewall List`);
    const response = await fetch(endpoint, options);
    const data = await response.json();
    if (!data?.success) {
      console.error(`Failed to remove ${ids} from Firewall List`, JSON.stringify(data.errors));
      return false;
    } else {
      return true;
    }
  } catch (error) {
    console.error(`Exception while removing ${ids} from Firewall List`, error);
    return false;
  }
}

export async function updateFirewallList(env: Env, hostnames: string[]): Promise<[boolean, Record<string, string>]> {
  const acceptableHostnames = hostnames.filter(hostname => hostname.includes('.'));
  if (acceptableHostnames.length === 0) return [false, {}];

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/rules/lists/${env.CLOUDFLARE_BLOCKED_DOMAINS_LIST_ID}/items`;

  const body = acceptableHostnames.map(hostname => ({
    "hostname": { url_hostname: hostname },
    "comment": `Auto-suspended by worker on ${new Date().toISOString()}`
  }));

  const options: RequestInit = {
    method: "POST",
    headers: {
      'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };

  try {
    console.log(`Updating Firewall List for ${hostnames}`);
    const response = await fetch(endpoint, options);
    const data = await response.json();
    if (!data?.success) {
      console.error(`Failed to update Firewall List for ${hostnames}`, JSON.stringify(data.errors));
      return [false, {}];
    } else {
      const responses = await Promise.all(acceptableHostnames.map(hostname => searchFirewallList(env, hostname)));
      const idMap = responses.reduce((acc, r) => {
        acc[r.hostname.url_hostname] = r.id
        return acc
      }, {} as Record<string, string>)
      console.log(`Successfully updated Firewall List for ${hostnames}`);
      return [true, idMap];
    }
  } catch (error) {
    console.error(`Exception while updating Firewall List for ${hostnames}`, error);
    debugger
    return [false, {}];
  }
}

export async function searchFirewallList(env: Env, hostname: string): Promise<Map<string, any>> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/rules/lists/${env.CLOUDFLARE_BLOCKED_DOMAINS_LIST_ID}/items?search=${hostname}`;
  const options: RequestInit = {
    method: "GET",
    headers: {
      'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
    
  try {
    console.log(`Searching Firewall List for ${hostname}`);
    const response = await fetch(endpoint, options);
    const data = await response.json();
    if (!data?.success) {
      console.error(`Failed to search Firewall List for ${hostname}`, JSON.stringify(data.errors));
      return {};
    } else {
      return data.result[0] as any;
    }
  } catch (error) {
    console.error(`Exception while searching Firewall List for ${hostname}`, error);
    return {};
  }
}