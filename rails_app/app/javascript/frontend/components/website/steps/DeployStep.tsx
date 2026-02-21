import DeployPage from "@pages/Deploy";

/**
 * Website Deploy step — renders the shared Deploy UI.
 * The URL path (/website/deploy) tells the backend to deploy website only.
 */
export default function DeployStep() {
  return <DeployPage />;
}
