import type { UseFormReturn, FieldValues, Path } from "react-hook-form";
import type { Ads } from "@shared";
import type { AssetFieldName } from "./fieldNameParser";

interface HandleLockToggleParams<T extends FieldValues> {
  methods: UseFormReturn<T>;
  fieldName: AssetFieldName;
  index: number;
  targetFieldName: AssetFieldName;
  getStateAssets: () => Ads.Asset[] | undefined;
  setState: (updates: Record<string, Ads.Asset[] | undefined>) => void;
}

/**
 * Handles toggling the locked state of an asset field.
 * Validates that empty fields cannot be locked and syncs the state
 * between the form and the external state manager.
 */
export function handleLockToggle<T extends FieldValues>({
  methods,
  fieldName,
  index,
  targetFieldName,
  getStateAssets,
  setState,
}: HandleLockToggleParams<T>): void {
  if (fieldName !== targetFieldName) return;

  const currentFields = methods.getValues(targetFieldName as Path<T>) as Ads.Asset[];
  const isLocked = currentFields[index].locked;

  if (!isLocked && !currentFields[index].text) {
    methods.setError(`${targetFieldName}.${index}.text` as Path<T>, {
      type: "manual",
      message: "Cannot lock an empty input.",
    });
    return;
  }

  const updatedFields = currentFields.map((field, i) =>
    i === index ? { ...field, locked: !isLocked } : field
  );
  methods.setValue(targetFieldName as Path<T>, updatedFields as T[Path<T>]);

  const stateAssets = getStateAssets();
  const updatedState = stateAssets?.map((asset, i) =>
    i === index ? { ...asset, locked: !isLocked } : asset
  );
  setState({ [targetFieldName]: updatedState });
}

/**
 * Creates a lock toggle handler bound to a specific field name.
 * Returns a function compatible with AdCampaignFieldList's onLockToggle prop.
 * @param methods - The form methods.
 * @param targetFieldName - The field name to toggle the lock for.
 * @param getStateAssets - Getter function to retrieve the current state assets.
 * @param setState - The function to set the state.
 * @returns A function to toggle the lock for a specific field.
 */
export function createLockToggleHandler<T extends FieldValues>(
  methods: UseFormReturn<T>,
  targetFieldName: AssetFieldName,
  getStateAssets: () => Ads.Asset[] | undefined,
  setState: (updates: Record<string, Ads.Asset[] | undefined>) => void
) {
  return (fieldName: AssetFieldName, index: number) => {
    handleLockToggle({
      methods,
      fieldName,
      index,
      targetFieldName,
      getStateAssets,
      setState,
    });
  };
}
