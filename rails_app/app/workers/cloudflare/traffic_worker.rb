class Cloudflare::TrafficWorker < ApplicationWorker
  def perform(options = {})
    zone_id = options[:zone_id]
    start_time = EST.now.beginning_of_hour
    end_time = EST.now.end_of_hour

    # sample report: {"abeverything.com" => 16, "example.abeverything.com" => 50}
    traffic_report = Cloudflare::Analytics::Queries::TrafficQueries.new.hourly_traffic_by_host(
      zone_id: zone_id,
      start_time: start_time,
      end_time: end_time
    )

    # Ensure each domain has the cloudflare zone_id set
    #...

    # Upsert to domain_request_counts
    # 
    # %Q(
    # SELECT DATE_TRUNC('month', created_date) AS month, COUNT(*) AS count
    # FROM domain_request_counts
    # WHERE user_id = user_id
    # AND created_date BETWEEN ? AND ? -- ensure this always matches the hour bounded by the start_time and end_time,
    # in fact, maybe just make it = start_time
    # GROUP BY 1
    # )

    # Summarize domain request counts by user_id, month
    # Upsert to user_request_counts
    # If user_request_count > user.plan.plan_limit.where(limit_type: "requests_per_month").limit
    # Then call the Cloudflare Firewall worker to explicitly BLOCk the user's domains
    #
    ##
    # In Cloudflare Firewall worker, call another Cloudflare Service (put with our other services)
    # matching this logic:

    # export async function updateFirewallList(env: Env, hostnames: string[]): Promise<[boolean, Record<string, string>]> {
#   const acceptableHostnames = hostnames.filter(hostname => hostname.includes('.'));
#   if (acceptableHostnames.length === 0) return [false, {}];

#   const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/rules/lists/${env.CLOUDFLARE_BLOCKED_DOMAINS_LIST_ID}/items`;

#   const body = acceptableHostnames.map(hostname => ({
#     "hostname": { url_hostname: hostname },
#     "comment": `Auto-suspended by worker on ${new Date().toISOString()}`
#   }));

#   const options: RequestInit = {
#     method: "POST",
#     headers: {
#       'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
#       'Content-Type': 'application/json',
#     },
#     body: JSON.stringify(body),
#   };

#   try {
#     console.log(`Updating Firewall List for ${hostnames}`);
#     const response = await fetch(endpoint, options);
#     const data = await response.json();
#     if (!data?.success) {
#       console.error(`Failed to update Firewall List for ${hostnames}`, JSON.stringify(data.errors));
#       return [false, {}];
#     } else {
#       const responses = await Promise.all(acceptableHostnames.map(hostname => searchFirewallList(env, hostname)));
#       const idMap = responses.reduce((acc, r) => {
#         acc[r.hostname.url_hostname] = r.id
#         return acc
#       }, {} as Record<string, string>)
#       console.log(`Successfully updated Firewall List for ${hostnames}`);
#       return [true, idMap];
#     }
#   } catch (error) {
#     console.error(`Exception while updating Firewall List for ${hostnames}`, error);
#     debugger
#     return [false, {}];
#   }
# }

# Update user's firewall_rules models (or create them), denoting that the domains are blocked
#  In future traffic workers, exit early for users who are already blocked

  end

  class BatchWorker < ApplicationWorker
    def perform(batch_options = {})
      Cloudflare::Analytics::Queries::TrafficQueries.new.get_all_zones do |zones|
        if zones.is_a?(Array)
          # This is a successful response, an array of zone IDs
          # such as: ["53af2b7fed23483ab370ef62a78b411b", "5ea4ca3dddb10aa3bd8f3c848ad8a95f"]
          zones.each do |zone|
            Cloudflare::TrafficWorker.perform_async(zone_id: zone)
          end
        else
          Rollbar.error("Failed to get zones", zones)
        end
      end
    end
  end
end