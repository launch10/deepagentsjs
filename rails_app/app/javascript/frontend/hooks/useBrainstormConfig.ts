import { usePage } from "@inertiajs/react";
import type { InertiaProps } from "@shared";

type NewBrainstormProps =
  InertiaProps.paths["/projects/new"]["get"]["responses"]["200"]["content"]["application/json"];
type UpdateBrainstormProps =
  InertiaProps.paths["/projects/{uuid}/brainstorm"]["get"]["responses"]["200"]["content"]["application/json"];
type BrainstormPageProps = NewBrainstormProps | UpdateBrainstormProps;

/**
 * Provides langgraph connection config from Inertia page props.
 * Used by langgraph-ai-sdk-react hooks.
 */
export function useBrainstormConfig() {
  const { props } = usePage<BrainstormPageProps>();

  const jwt = props.jwt;
  const langgraphPath = props.langgraph_path;
  const initialThreadId = props.thread_id || undefined;
  const project = props.project;

  const api = langgraphPath ? new URL("api/brainstorm/stream", langgraphPath).toString() : "";

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt}`,
  };

  return {
    api,
    headers,
    initialThreadId,
    project,
    isNewConversation: !initialThreadId,
  };
}
