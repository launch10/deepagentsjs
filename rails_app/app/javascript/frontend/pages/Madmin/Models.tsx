import { useState, useCallback, useEffect, createElement } from "react";
import { Switch } from "@components/ui/switch";
import { Input } from "@components/ui/input";
import { Button } from "@components/ui/button";
import { Badge } from "@components/ui/badge";
import { X, Plus, GripVertical, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { cn } from "@lib/utils";
import { Reorder } from "framer-motion";
import { useDebouncedCallback } from "use-debounce";
import { AdminLayout } from "../../layouts/admin-layout";

interface ModelConfig {
  id: number;
  modelKey: string;
  modelCard: string | null;
  enabled: boolean;
  maxUsagePercent: number | null;
  costIn: number | null;
  costOut: number | null;
  updatedAt: string;
}

interface ModelPreference {
  id: number;
  costTier: string;
  speedTier: string;
  skill: string;
  modelKeys: string[];
  updatedAt: string;
}

interface Props {
  modelConfigs: ModelConfig[];
  modelPreferences: ModelPreference[];
}

// Debounced input component for text/number fields
function DebouncedInput({
  value,
  onChange,
  type = "text",
  ...props
}: {
  value: string | number | null;
  onChange: (value: string) => void;
  type?: "text" | "number";
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const [localValue, setLocalValue] = useState(value ?? "");

  const debouncedOnChange = useDebouncedCallback((val: string) => {
    onChange(val);
  }, 500);

  useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  return (
    <Input
      {...props}
      type={type}
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value);
        debouncedOnChange(e.target.value);
      }}
    />
  );
}

// Draggable model badge component
function DraggableModelBadge({
  model,
  index,
  isDisabled,
  onRemove,
  saving,
}: {
  model: string;
  index: number;
  isDisabled: boolean;
  onRemove: () => void;
  saving: boolean;
}) {
  return (
    <Reorder.Item
      value={model}
      className={cn(
        "flex items-center gap-1 rounded-md px-2 py-1 select-none cursor-grab active:cursor-grabbing",
        isDisabled ? "bg-muted/50 opacity-50" : "bg-muted"
      )}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{index + 1}.</span>
      <span
        className={cn("text-sm font-mono", isDisabled && "line-through text-muted-foreground")}
      >
        {model}
      </span>
      {isDisabled && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1 text-amber-600 border-amber-600">
          off
        </Badge>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 text-destructive hover:text-destructive ml-1"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        disabled={saving}
      >
        <X className="h-3 w-3" />
      </Button>
    </Reorder.Item>
  );
}

function ModelsIndex({
  modelConfigs: initialConfigs,
  modelPreferences: initialPreferences,
}: Props) {
  const [configs, setConfigs] = useState<ModelConfig[]>(initialConfigs);
  const [preferences, setPreferences] = useState<ModelPreference[]>(initialPreferences);
  const [savingConfigs, setSavingConfigs] = useState<Record<number, boolean>>({});
  const [savingPrefs, setSavingPrefs] = useState<Record<number, boolean>>({});
  const [configErrors, setConfigErrors] = useState<Record<number, string[]>>({});
  const [prefErrors, setPrefErrors] = useState<Record<number, string[]>>({});

  // New model form state
  const [newModelKey, setNewModelKey] = useState("");
  const [newModelCard, setNewModelCard] = useState("");
  const [creatingModel, setCreatingModel] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Build a set of disabled model keys for quick lookup
  const disabledModels = new Set(configs.filter((c) => !c.enabled).map((c) => c.modelKey));

  // Model Config handlers
  const updateConfig = useCallback(
    async (id: number, field: string, value: boolean | number | string | null) => {
      setSavingConfigs((prev) => ({ ...prev, [id]: true }));
      setConfigErrors((prev) => ({ ...prev, [id]: [] }));

      setConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));

      try {
        const response = await fetch(`/admin/models/configs/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token":
              document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || "",
          },
          body: JSON.stringify({
            model_config: { [camelToSnake(field)]: value },
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setConfigErrors((prev) => ({ ...prev, [id]: data.errors || ["Update failed"] }));
          setConfigs(initialConfigs);
        } else {
          const updated = await response.json();
          setConfigs((prev) => prev.map((c) => (c.id === id ? updated : c)));
        }
      } catch {
        setConfigErrors((prev) => ({ ...prev, [id]: ["Network error"] }));
        setConfigs(initialConfigs);
      } finally {
        setSavingConfigs((prev) => ({ ...prev, [id]: false }));
      }
    },
    [initialConfigs]
  );

  // Model Preference handlers
  const updatePreference = useCallback(
    async (id: number, modelKeys: string[]) => {
      setSavingPrefs((prev) => ({ ...prev, [id]: true }));
      setPrefErrors((prev) => ({ ...prev, [id]: [] }));

      setPreferences((prev) => prev.map((p) => (p.id === id ? { ...p, modelKeys } : p)));

      try {
        const response = await fetch(`/admin/models/preferences/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token":
              document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || "",
          },
          body: JSON.stringify({
            model_preference: { model_keys: modelKeys },
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setPrefErrors((prev) => ({ ...prev, [id]: data.errors || ["Update failed"] }));
          setPreferences(initialPreferences);
        } else {
          const updated = await response.json();
          setPreferences((prev) => prev.map((p) => (p.id === id ? updated : p)));
        }
      } catch {
        setPrefErrors((prev) => ({ ...prev, [id]: ["Network error"] }));
        setPreferences(initialPreferences);
      } finally {
        setSavingPrefs((prev) => ({ ...prev, [id]: false }));
      }
    },
    [initialPreferences]
  );

  const handleToggle = (id: number, enabled: boolean) => {
    updateConfig(id, "enabled", enabled);
  };

  const handleTextChange = (id: number, field: string, value: string) => {
    const finalValue = value === "" ? null : value;
    updateConfig(id, field, finalValue);
  };

  const handleNumberChange = (id: number, field: string, value: string) => {
    const numValue = value === "" ? null : Number(value);
    updateConfig(id, field, numValue);
  };

  const removeModel = (pref: ModelPreference, index: number) => {
    const newKeys = [...pref.modelKeys];
    newKeys.splice(index, 1);
    updatePreference(pref.id, newKeys);
  };

  const addModel = (pref: ModelPreference, modelKey: string) => {
    if (!pref.modelKeys.includes(modelKey)) {
      updatePreference(pref.id, [...pref.modelKeys, modelKey]);
    }
  };

  const handleReorder = (pref: ModelPreference, newKeys: string[]) => {
    updatePreference(pref.id, newKeys);
  };

  // Create new model
  const createModel = async () => {
    if (!newModelKey.trim()) {
      setCreateError("Model key is required");
      return;
    }

    setCreatingModel(true);
    setCreateError(null);

    try {
      const response = await fetch("/admin/models/configs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token":
            document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || "",
        },
        body: JSON.stringify({
          model_config: {
            model_key: newModelKey.trim().toLowerCase(),
            model_card: newModelCard.trim() || null,
            enabled: true,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setCreateError(data.errors?.join(", ") || "Failed to create model");
      } else {
        const created = await response.json();
        setConfigs((prev) => [...prev, created].sort((a, b) => a.modelKey.localeCompare(b.modelKey)));
        setNewModelKey("");
        setNewModelCard("");
      }
    } catch {
      setCreateError("Network error");
    } finally {
      setCreatingModel(false);
    }
  };

  // Delete model
  const deleteModel = async (id: number) => {
    const config = configs.find((c) => c.id === id);
    if (!config) return;

    if (!confirm(`Are you sure you want to delete "${config.modelKey}"? This cannot be undone.`)) {
      return;
    }

    setSavingConfigs((prev) => ({ ...prev, [id]: true }));

    try {
      const response = await fetch(`/admin/models/configs/${id}`, {
        method: "DELETE",
        headers: {
          "X-CSRF-Token":
            document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || "",
        },
      });

      if (response.ok) {
        setConfigs((prev) => prev.filter((c) => c.id !== id));
      } else {
        const data = await response.json();
        setConfigErrors((prev) => ({ ...prev, [id]: data.errors || ["Delete failed"] }));
      }
    } catch {
      setConfigErrors((prev) => ({ ...prev, [id]: ["Network error"] }));
    } finally {
      setSavingConfigs((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Group preferences by cost tier and speed tier
  const groupedPrefs = preferences.reduce(
    (acc, pref) => {
      const key = `${pref.costTier}-${pref.speedTier}`;
      if (!acc[key]) {
        acc[key] = { costTier: pref.costTier, speedTier: pref.speedTier, prefs: [] };
      }
      acc[key].prefs.push(pref);
      return acc;
    },
    {} as Record<string, { costTier: string; speedTier: string; prefs: ModelPreference[] }>
  );

  const sortedGroups = Object.values(groupedPrefs).sort((a, b) => {
    const costOrder = { paid: 0, free: 1 };
    const speedOrder = { slow: 0, fast: 1, blazing: 2 };
    const costA = costOrder[a.costTier as keyof typeof costOrder] ?? 2;
    const costB = costOrder[b.costTier as keyof typeof costOrder] ?? 2;
    if (costA !== costB) return costA - costB;
    const speedA = speedOrder[a.speedTier as keyof typeof speedOrder] ?? 3;
    const speedB = speedOrder[b.speedTier as keyof typeof speedOrder] ?? 3;
    return speedA - speedB;
  });

  const availableModels = configs.map((c) => c.modelKey).sort();

  return (
    <div className="p-6 space-y-12">
      {/* Model Configs Section */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">Model Configuration</h1>
        </div>
        <p className="text-muted-foreground mb-6">
          Configure available models and their settings. Changes take effect within 5 minutes.
        </p>

        {/* New Model Form - inline row */}
        <div className="mb-4 flex items-center gap-3">
          <input
            value={newModelKey}
            onChange={(e) => setNewModelKey(e.target.value)}
            placeholder="Model key"
            disabled={creatingModel}
            className="w-36 h-9 rounded-md border border-neutral-300 bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-shadow"
          />
          <input
            value={newModelCard}
            onChange={(e) => setNewModelCard(e.target.value)}
            placeholder="API model card"
            disabled={creatingModel}
            className="w-64 h-9 rounded-md border border-neutral-300 bg-transparent px-3 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-shadow"
          />
          <Button
            onClick={createModel}
            disabled={creatingModel}
            className="bg-primary border-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 h-auto"
          >
            Add Model
          </Button>
          {createError && <span className="text-sm text-destructive">{createError}</span>}
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-4 font-medium">Model</th>
                <th className="text-left py-3 px-4 font-medium">API Model Card</th>
                <th className="text-center py-3 px-4 font-medium">Enabled</th>
                <th className="text-center py-3 px-4 font-medium">Max Usage %</th>
                <th className="text-center py-3 px-4 font-medium">Cost In ($/1M)</th>
                <th className="text-center py-3 px-4 font-medium">Cost Out ($/1M)</th>
                <th className="text-center py-3 px-4 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => (
                <tr
                  key={config.id}
                  className={cn(
                    "border-b last:border-b-0 transition-colors",
                    savingConfigs[config.id] && "opacity-60",
                    !config.enabled && "bg-muted/30"
                  )}
                >
                  <td className="py-3 px-4">
                    <div className={cn("font-medium capitalize", !config.enabled && "text-muted-foreground")}>
                      {config.modelKey}
                    </div>
                    {configErrors[config.id]?.length > 0 && (
                      <div className="text-sm text-destructive mt-1">
                        {configErrors[config.id].join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <DebouncedInput
                      type="text"
                      value={config.modelCard ?? ""}
                      onChange={(value) => handleTextChange(config.id, "modelCard", value)}
                      disabled={savingConfigs[config.id]}
                      className="w-64 text-sm font-mono"
                      placeholder="e.g. claude-opus-4-5"
                    />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(checked) => handleToggle(config.id, checked)}
                      disabled={savingConfigs[config.id]}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <DebouncedInput
                      type="number"
                      min={0}
                      max={100}
                      value={config.maxUsagePercent ?? ""}
                      onChange={(value) => handleNumberChange(config.id, "maxUsagePercent", value)}
                      disabled={savingConfigs[config.id]}
                      className="w-20 text-center mx-auto"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <DebouncedInput
                      type="number"
                      step="0.01"
                      min={0}
                      value={config.costIn ?? ""}
                      onChange={(value) => handleNumberChange(config.id, "costIn", value)}
                      disabled={savingConfigs[config.id]}
                      className="w-24 text-center mx-auto"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <DebouncedInput
                      type="number"
                      step="0.01"
                      min={0}
                      value={config.costOut ?? ""}
                      onChange={(value) => handleNumberChange(config.id, "costOut", value)}
                      disabled={savingConfigs[config.id]}
                      className="w-24 text-center mx-auto"
                    />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteModel(config.id)}
                      disabled={savingConfigs[config.id]}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {configs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No model configurations found. Run{" "}
            <code className="bg-muted px-1 rounded">rails db:seed</code> to create them.
          </div>
        )}
      </section>

      {/* Model Preferences Section */}
      <section>
        <h2 className="text-xl font-bold mb-2">Model Preferences</h2>
        <p className="text-muted-foreground mb-6">
          Configure which models to use for each cost/speed/skill combination. Models are tried in
          order from left to right. Drag models to reorder. Disabled models are shown greyed out.
        </p>

        <div className="space-y-8">
          {sortedGroups.map((group) => (
            <div key={`${group.costTier}-${group.speedTier}`} className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={group.costTier === "paid" ? "default" : "secondary"}>
                  {group.costTier}
                </Badge>
                <Badge variant="outline">{group.speedTier}</Badge>
              </div>

              <div className="rounded-lg border bg-card">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-3 px-4 font-medium w-32">Skill</th>
                      <th className="text-left py-3 px-4 font-medium">
                        Preference Order (Primary → Fallbacks)
                      </th>
                      <th className="text-left py-3 px-4 font-medium w-44">Add Model</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.prefs
                      .sort((a, b) => a.skill.localeCompare(b.skill))
                      .map((pref) => (
                        <tr
                          key={pref.id}
                          className={cn(
                            "border-b last:border-b-0 transition-colors",
                            savingPrefs[pref.id] && "opacity-60"
                          )}
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium capitalize">{pref.skill}</div>
                            {prefErrors[pref.id]?.length > 0 && (
                              <div className="text-sm text-destructive mt-1">
                                {prefErrors[pref.id].join(", ")}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Reorder.Group
                              axis="x"
                              values={pref.modelKeys}
                              onReorder={(newKeys) => handleReorder(pref, newKeys)}
                              className="flex flex-wrap gap-2"
                            >
                              {pref.modelKeys.map((model, index) => (
                                <DraggableModelBadge
                                  key={model}
                                  model={model}
                                  index={index}
                                  isDisabled={disabledModels.has(model)}
                                  onRemove={() => removeModel(pref, index)}
                                  saving={savingPrefs[pref.id]}
                                />
                              ))}
                            </Reorder.Group>
                            {pref.modelKeys.length === 0 && (
                              <span className="text-muted-foreground text-sm italic">
                                No models configured
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Select
                              disabled={savingPrefs[pref.id]}
                              onValueChange={(value: string) => addModel(pref, value)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Add model..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableModels
                                  .filter((m) => !pref.modelKeys.includes(m))
                                  .map((model) => (
                                    <SelectItem
                                      key={model}
                                      value={model}
                                      className={cn(disabledModels.has(model) && "opacity-50")}
                                    >
                                      {model}
                                      {disabledModels.has(model) && " (disabled)"}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {preferences.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No model preferences found. Run{" "}
            <code className="bg-muted px-1 rounded">rails db:seed</code> to create them.
          </div>
        )}
      </section>
    </div>
  );
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// Use AdminLayout for admin pages
ModelsIndex.layout = (page: React.ReactNode) => createElement(AdminLayout, null, page);

export default ModelsIndex;
