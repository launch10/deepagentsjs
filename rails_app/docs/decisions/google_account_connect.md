# Google Account Connection Flow

Mildly complicated flow that involves multiple steps and components.

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. User clicks Deploy │
│ └── Frontend sends: { command: "deploy", campaignId: X } │
│ │
│ 2. Langgraph runs deployCampaignGraph │
│ └── Calls shouldSkipGoogleConnect → Rails API /google/connection_status │
│ │
│ 3. If NOT connected: │
│ └── googleConnectNode creates JobRun(GoogleOAuthConnect) │
│ └── Sets task.result = { action: "oauth_required" } │
│ └── Graph EXITS (reaches END) │
│ │
│ 4. Frontend detects OAuth needed, presents link │
│ └── User clicks, redirected to /auth/google_oauth2 │
│ └── Rails stores session[:langgraph_thread_id] for callback │
│ │
│ 5. User completes OAuth flow │
│ └── Google redirects to Rails callback │
│ └── omniauth_callbacks_controller#google_oauth2_connected fires │
│ └── Finds JobRun by thread_id, marks COMPLETED │
│ └── Calls job_run.notify_langgraph → enqueues LanggraphCallbackWorker │
│ │
│ 6. LanggraphCallbackWorker delivers webhook │
│ └── POST /webhooks/job_run_callback │
│ └── Updates task.result = { google_email: "..." } │
│ └── graph.updateState() RUNS THE GRAPH │
│ │
│ 7. googleConnectNode sees result, marks task COMPLETED │
│ └── Graph routes to shouldSkipGoogleVerify │
│ └── Calls Rails API /google/invite_status │
│ │
│ 8. If invite NOT accepted: │
│ └── verifyGoogleNode creates JobRun(GoogleAdsInvite, deployId: X) │
│ └── Rails dispatches SendInviteWorker │
│ └── Graph EXITS (reaches END) │
│ │
│ 9. SendInviteWorker runs │
│ └── Creates/syncs Google Ads account │
│ └── Sends invitation email via Google API │
│ └── Schedules PollInviteAcceptanceWorker in 30s │
│ │
│ 10. Frontend polls every 3s during invite wait │
│ └── Each poll runs verifyGoogleNode │
│ └── Node calls deployApi.touch(deployId) → updates user_active_at │
│ └── Returns empty (waiting) │
│ │
│ 11. Batch scheduler runs every 30s (Zhong) │
│ └── PollActiveInvitesWorker finds deploys with user_active_at < 5 min │
│ └── For each, enqueues PollInviteAcceptanceWorker │
│ │
│ 12. PollInviteAcceptanceWorker runs │
│ └── Calls invitation.google_refresh_status (Google API) │
│ └── If accepted: │
│ └── job_run.complete!({ status: "accepted" }) │
│ └── job_run.notify_langgraph → enqueues LanggraphCallbackWorker │
│ │
│ 13. Webhook updates task, graph runs │
│ └── verifyGoogleNode sees result.status === "accepted" │
│ └── Marks task COMPLETED │
│ └── Routes to deployCampaign │
│ │
│ 14. Campaign deploys, user sees success │
└─────────────────────────────────────────────────────────────────────────────┘
