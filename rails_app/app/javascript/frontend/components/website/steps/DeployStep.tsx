import DeployPage from "@pages/Deploy";

/**
 * Website Deploy step — renders the shared Deploy UI configured for website-only deploy.
 * The controller passes deploy_type: "website" in page props, which the deploy hooks
 * use to send deploy={ website: true, googleAds: false } to langgraph.
 */
export default function DeployStep() {
  return <DeployPage />;
}
