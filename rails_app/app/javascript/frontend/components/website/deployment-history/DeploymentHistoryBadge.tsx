import { Badge } from "@components/ui/badge";

export default function DeploymentHistoryBadge({
  variant,
}: {
  variant: "new" | "live" | "success" | "failed";
}) {
  const renderBadge = () => {
    switch (variant) {
      case "new":
        return <Badge className="border-none bg-success-500 text-white">New</Badge>;
      case "live":
        return <Badge className="border-none bg-success-100 text-success-700">Live</Badge>;
      case "success":
        return <Badge className="border-none bg-success-100 text-success-700">Success</Badge>;
      case "failed":
        return <Badge className="border-none bg-error-100 text-secondary-700">Failed</Badge>;
    }
  };

  return renderBadge();
}
