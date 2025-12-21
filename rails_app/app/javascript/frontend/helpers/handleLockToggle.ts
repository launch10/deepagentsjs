import type { UseFormReturn, FieldValues, Path } from "react-hook-form";
import type { Ads } from "@shared";
import type { AssetFieldName } from "./fieldNameParser";

type SetState = (updates: Record<string, Ads.Asset[] | undefined>) => void;

export function createLockToggleHandler<T extends FieldValues>(
  fieldName: AssetFieldName,
  methods: UseFormReturn<T>,
  getFilteredAssets: () => Ads.Asset[],
  getAllAssets: () => Ads.Asset[] | undefined,
  setState: SetState
) {
  return (_triggerFieldName: string, index: number) => {
    const filtered = getFilteredAssets();
    const all = getAllAssets();
    const assetId = filtered[index]?.id;
    if (!assetId) return;

    const asset = filtered[index];
    const isLocked = asset.locked;

    if (!isLocked && !asset.text) {
      methods.setError(`${fieldName}.${index}.text` as Path<T>, {
        type: "manual",
        message: "Cannot lock an empty input.",
      });
      return;
    }

    setState({
      [fieldName]: all?.map((a) => (a.id === assetId ? { ...a, locked: !a.locked } : a)),
    });
  };
}
