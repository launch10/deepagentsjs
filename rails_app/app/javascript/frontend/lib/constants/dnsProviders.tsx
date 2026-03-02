import AwsLogo from "@assets/aws-logo.png";
import CloudflareLogo from "@assets/cloudflare-logo.png";
import GoDaddyLogo from "@assets/godaddy-logo.png";
import NamecheapLogo from "@assets/namecheap-logo.svg";

export interface DnsProvider {
  name: string;
  logo?: React.ReactNode;
  guideUrl: string;
}

export const DNS_PROVIDERS: DnsProvider[] = [
  {
    name: "Cloudflare",
    logo: <img src={CloudflareLogo} alt="Cloudflare" className="w-4" />,
    guideUrl: "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/",
  },
  {
    name: "GoDaddy",
    logo: <img src={GoDaddyLogo} alt="GoDaddy" className="w-4" />,
    guideUrl: "https://www.godaddy.com/help/add-a-cname-record-19236",
  },
  {
    name: "Namecheap",
    logo: <img src={NamecheapLogo} alt="Namecheap" className="w-4" />,
    guideUrl:
      "https://www.namecheap.com/support/knowledgebase/article.aspx/9646/2237/how-to-create-a-cname-record-for-your-domain/",
  },
  {
    name: "AWS Route 53",
    logo: <img src={AwsLogo} alt="AWS Route 53" className="w-4" />,
    guideUrl:
      "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html",
  },
];

export const CNAME_TARGET = "cname.launch10.com";
