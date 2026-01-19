import type { WebContainer } from "@webcontainer/api";

export interface PreviewInfo {
  port: number;
  ready: boolean;
  baseUrl: string;
}

export type WebContainerStatus =
  | "idle"
  | "booting"
  | "mounting"
  | "installing"
  | "starting"
  | "ready"
  | "error";

export interface WebContainerState {
  status: WebContainerStatus;
  previewUrl: string | null;
  error: string | null;
  webcontainer: WebContainer | null;
}
