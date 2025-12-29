import { useState, useCallback, useEffect, useRef } from "react";
import { Link, Check, Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { useSocialLinks, useBulkUpsertSocialLinks } from "@api/socialLinks.hooks";
import { useDebounce } from "@hooks/useDebounce";

interface SocialLinksSectionProps {
  className?: string;
}

// Local platforms we support in the UI
type LocalSocialPlatform = "twitter" | "instagram" | "youtube";

interface SocialLinks {
  twitter: string;
  instagram: string;
  youtube: string;
}

const SOCIAL_PLATFORMS: { platform: LocalSocialPlatform; placeholder: string }[] = [
  { platform: "twitter", placeholder: "Twitter URL" },
  { platform: "instagram", placeholder: "Instagram URL" },
  { platform: "youtube", placeholder: "Youtube URL" },
];

export function SocialLinksSection({ className }: SocialLinksSectionProps) {
  // Fetch existing social links from API
  const { data: existingSocialLinks = [], isLoading: isFetching } = useSocialLinks();
  const bulkUpsertMutation = useBulkUpsertSocialLinks();

  // Use a ref to store the mutate function to avoid it being a dependency
  const mutateRef = useRef(bulkUpsertMutation.mutate);
  mutateRef.current = bulkUpsertMutation.mutate;

  // Track whether user has made changes (prevents auto-save on initial load)
  const hasUserEditedRef = useRef(false);
  // Track the last saved value to prevent duplicate saves
  const lastSavedRef = useRef<string>("");

  // Local state for form
  const [localLinks, setLocalLinks] = useState<SocialLinks>({
    twitter: "",
    instagram: "",
    youtube: "",
  });

  // Initialize local state from API data
  useEffect(() => {
    if (existingSocialLinks.length > 0) {
      const linksMap: SocialLinks = {
        twitter: "",
        instagram: "",
        youtube: "",
      };
      existingSocialLinks.forEach((link) => {
        if (link.platform && link.url) {
          const platform = link.platform as LocalSocialPlatform;
          if (platform in linksMap) {
            linksMap[platform] = link.url;
          }
        }
      });
      setLocalLinks(linksMap);
      // Set the last saved value to prevent re-saving the same data
      lastSavedRef.current = JSON.stringify(linksMap);
    }
  }, [existingSocialLinks]);

  // Debounce the local links for auto-save
  const debouncedLinks = useDebounce(localLinks, 1000);

  // Auto-save when debounced links change
  useEffect(() => {
    // Only save if user has made changes (prevents auto-save on initial load)
    if (!hasUserEditedRef.current) return;

    // Only save if we have any non-empty values
    const hasValues = Object.values(debouncedLinks).some((v) => v.trim().length > 0);
    if (!hasValues) return;

    // Check if the links have actually changed from last save
    const currentValue = JSON.stringify(debouncedLinks);
    if (currentValue === lastSavedRef.current) return;

    // Convert to API format and save
    const socialLinksToSave = SOCIAL_PLATFORMS.filter(
      ({ platform }) => debouncedLinks[platform].trim().length > 0
    ).map(({ platform }) => ({
      platform,
      url: debouncedLinks[platform],
    }));

    if (socialLinksToSave.length > 0) {
      lastSavedRef.current = currentValue;
      mutateRef.current({ socialLinks: socialLinksToSave });
    }
  }, [debouncedLinks]);

  const handleLinkChange = useCallback((platform: LocalSocialPlatform, url: string) => {
    hasUserEditedRef.current = true;
    setLocalLinks((prev) => ({ ...prev, [platform]: url }));
  }, []);

  if (isFetching) {
    return (
      <div className={twMerge("space-y-2", className)}>
        <h3 className="text-sm font-semibold text-base-500">Social Links</h3>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-10 bg-neutral-100 rounded-lg animate-pulse"
              data-slot="skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={twMerge("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-base-500">Social Links</h3>
        {bulkUpsertMutation.isPending && (
          <Loader2 className="w-3 h-3 text-base-300 animate-spin" />
        )}
      </div>

      <div className="space-y-2">
        {SOCIAL_PLATFORMS.map(({ platform, placeholder }) => (
          <SocialLinkInput
            key={platform}
            platform={platform}
            placeholder={placeholder}
            value={localLinks[platform]}
            onChange={(value) => handleLinkChange(platform, value)}
            isSaved={
              existingSocialLinks.some(
                (link) => link.platform === platform && link.url === localLinks[platform]
              ) && !bulkUpsertMutation.isPending
            }
          />
        ))}
      </div>

      <p className="text-xs text-base-300">All fields are optional</p>
    </div>
  );
}

interface SocialLinkInputProps {
  platform: LocalSocialPlatform;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  isSaved: boolean;
}

function SocialLinkInput({
  platform,
  placeholder,
  value,
  onChange,
  isSaved,
}: SocialLinkInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isValid, setIsValid] = useState(true);

  // Sync local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const validateUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid (optional)
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);

      // Clear invalid state while typing
      if (!isValid) {
        setIsValid(true);
      }

      // Validate and propagate to parent
      const valid = validateUrl(newValue);
      if (valid) {
        onChange(newValue);
      }
    },
    [isValid, onChange]
  );

  const handleBlur = useCallback(() => {
    const valid = validateUrl(localValue);
    setIsValid(valid);
  }, [localValue]);

  // Show checkmark when URL is valid, has content, and is saved
  const hasValidContent = isValid && localValue.trim().length > 0;
  const showCheckmark = hasValidContent && isSaved;

  return (
    <div className="relative">
      <div className="absolute left-2 top-1/2 -translate-y-1/2">
        {showCheckmark ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Link className="w-4 h-4 text-base-300" />
        )}
      </div>
      <input
        type="url"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={twMerge(
          "w-full pl-8 pr-3 py-2 text-sm border rounded-lg",
          "focus:outline-none focus:ring-1 focus:ring-primary-500",
          isValid ? "border-neutral-200" : "border-red-300"
        )}
        data-testid={`social-link-${platform}`}
        aria-label={placeholder}
        aria-invalid={!isValid}
      />
      {!isValid && (
        <p className="text-xs text-red-500 mt-1" role="alert">
          Please enter a valid URL
        </p>
      )}
    </div>
  );
}
