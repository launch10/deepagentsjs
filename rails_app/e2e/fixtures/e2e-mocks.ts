import { e2eConfig } from "../config";

const BASE_URL = e2eConfig.railsBaseUrl;

export const E2EMocks = {
  async setInviteStatus(status: "pending" | "accepted" | "declined" | "expired") {
    const response = await fetch(`${BASE_URL}/test/e2e/set_invite_status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      throw new Error(`Failed to set invite status: ${response.status}`);
    }
  },

  async reset() {
    await fetch(`${BASE_URL}/test/e2e/reset`, { method: "DELETE" });
  },
};
