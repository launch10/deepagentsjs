import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { UseFormReturn, Control } from "react-hook-form";
import { useAdsChatState, useAdsChatActions, useAutosaveCampaign, useAdsChatIsStreaming } from "./index";
import { useFormRegistration } from "@hooks/useFormRegistration";
import { createRefreshHandler } from "../utils/refreshAssets";
import { createLockToggleHandler } from "@helpers/handleLockToggle";
import { Ads, generateUUID } from "@shared";
import type { UpdateCampaignRequestBody } from "@rails_api_base";

type AssetArrayKey = "headlines" | "descriptions" | "callouts" | "keywords";

interface UseAssetFormConfig {
  assetKey: AssetArrayKey;
  formId: string;
  formGroup: string;
  schema: z.ZodSchema;
  transformFn: (data: any) => Partial<UpdateCampaignRequestBody> | null;
  refreshStage?: string;
}

interface UseAssetFormReturn {
  addAsset: (text: string) => void;
  removeAsset: (index: number) => void;
  updateAsset: (index: number, text: string) => void;
  lockToggle: (fieldName: string, index: number) => void;
  refreshAssets: () => void;
  filteredAssets: Ads.Asset[];
  fields: Ads.Asset[];
  methods: UseFormReturn<any>;
  control: Control<any>;
  getData: () => Partial<UpdateCampaignRequestBody> | null;
  isAutosaving: boolean;
  autosaveError: Error | null;
  saveNow: () => Promise<void>;
}

export function useAssetForm({
  assetKey,
  formId,
  formGroup,
  schema,
  transformFn,
  refreshStage,
}: UseAssetFormConfig): UseAssetFormReturn {
  const allAssets = useAdsChatState(assetKey);
  const { setState, updateState, saveState } = useAdsChatActions();
  const isStreaming = useAdsChatIsStreaming();
  const isStreamingRef = useRef(false);
  isStreamingRef.current = isStreaming;

  const filteredAssets = (allAssets || []).filter((a: Ads.Asset) => !a.rejected);
  const prevIdsRef = useRef<string[]>([]);

  const methods = useForm({
    resolver: zodResolver(schema as any) as any,
    mode: "onChange",
    defaultValues: {
      [assetKey]: filteredAssets,
    },
  });

  const { getData, saveNow, isAutosaving, autosaveError } = useAutosaveCampaign({
    methods,
    formId,
    transformFn,
  });

  // Ref to avoid saveNow in the effect dependency array
  const saveNowRef = useRef(saveNow);
  saveNowRef.current = saveNow;

  // Sync chat state -> RHF when asset IDs change (structural changes like add/delete)
  // Also triggers saveNow() because methods.reset() does NOT trigger watch(),
  // so the normal autosave path won't fire for structural changes.
  useEffect(() => {
    const currentIds = filteredAssets.map((a: Ads.Asset) => a.id).join(",");
    const prevIds = prevIdsRef.current.join(",");

    if (currentIds !== prevIds) {
      const hadPrevIds = prevIdsRef.current.length > 0;
      methods.reset({ [assetKey]: filteredAssets });
      prevIdsRef.current = filteredAssets.map((a: Ads.Asset) => a.id);

      // Only autosave for user-initiated changes, not graph-streamed changes
      if (hadPrevIds && !isStreamingRef.current) {
        saveNowRef.current();
      }
    }
  }, [filteredAssets, methods, assetKey]);

  const addAsset = (text: string) => {
    const newAsset: Ads.Asset = {
      id: generateUUID(),
      text,
      locked: true,
      rejected: false,
    };
    const updatedAssets = [...(allAssets || []), newAsset];
    setState({ [assetKey]: updatedAssets });
    if (!isStreamingRef.current) {
      saveState({ [assetKey]: updatedAssets });
    }
  };

  const removeAsset = (index: number) => {
    const assetId = filteredAssets[index]?.id;
    if (!assetId) return;
    const updatedAssets = allAssets?.filter((a: Ads.Asset) => a.id !== assetId);
    setState({ [assetKey]: updatedAssets });
    if (!isStreamingRef.current) {
      saveState({ [assetKey]: updatedAssets });
    }
  };

  const updateAsset = (index: number, text: string) => {
    const assetId = filteredAssets[index]?.id;
    if (!assetId) return;
    const updatedAssets = allAssets?.map((a: Ads.Asset) => (a.id === assetId ? { ...a, text } : a));
    setState({ [assetKey]: updatedAssets });
    if (!isStreamingRef.current) {
      saveState({ [assetKey]: updatedAssets });
    }
  };

  const baseLockToggle = createLockToggleHandler(
    assetKey,
    methods,
    () => filteredAssets,
    () => allAssets,
    setState
  );

  const lockToggle = (fieldName: string, index: number) => {
    const asset = filteredAssets[index];
    if (!asset) return;

    // Don't persist if the base handler would reject (empty text on lock)
    const wouldReject = !asset.locked && !asset.text;

    baseLockToggle(fieldName, index);

    if (!wouldReject && !isStreamingRef.current) {
      const updatedAssets = allAssets?.map((a: Ads.Asset) =>
        a.id === asset.id ? { ...a, locked: !a.locked } : a
      );
      saveState({ [assetKey]: updatedAssets });
    }
  };

  const refreshAssets = () => {
    if (refreshStage) {
      createRefreshHandler(assetKey, allAssets, updateState, refreshStage);
    }
  };

  useFormRegistration(formGroup, methods, getData);

  const fields = filteredAssets.map((a: Ads.Asset) => ({ ...a, id: a.id }));

  return {
    addAsset,
    removeAsset,
    updateAsset,
    lockToggle,
    refreshAssets,
    filteredAssets,
    fields,
    methods,
    control: methods.control,
    getData,
    isAutosaving,
    autosaveError,
    saveNow,
  };
}
