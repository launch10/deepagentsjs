import { useCallback, useState } from "react";
import DevButton from "@components/shared/DevButton";
import { csrfFetch } from "@lib/csrfFetch";
import { useDeployId } from "~/stores/projectStore";

export default function FullResetButton() {
  const deployId = useDeployId();
  const [resetting, setResetting] = useState(false);

  const handleFullReset = useCallback(async () => {
    if (!deployId) return;
    if (
      !confirm(
        "Full reset? This removes Google OAuth, Ads account, invite, " +
          "campaign sync state, and the deploy. The next deploy will start from scratch."
      )
    )
      return;

    setResetting(true);
    try {
      await csrfFetch(`/test/deploys/${deployId}/full_reset`, {
        method: "DELETE",
      });
      window.location.reload();
    } catch (e) {
      console.error("Failed to full reset:", e);
      setResetting(false);
    }
  }, [deployId]);

  return (
    <DevButton onClick={handleFullReset} disabled={resetting}>
      {resetting ? "Resetting..." : "Full Reset (Dev)"}
    </DevButton>
  );
}
