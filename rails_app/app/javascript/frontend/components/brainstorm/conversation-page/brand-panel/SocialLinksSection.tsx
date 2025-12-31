import { useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, Check, Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { useSocialLinks, useBulkUpsertSocialLinks, useDeleteSocialLink } from "@api/socialLinks.hooks";

interface SocialLinksSectionProps {
  className?: string;
}

// Local platforms we support in the UI
type LocalSocialPlatform = "twitter" | "instagram" | "youtube";

// Flexible validation - accepts usernames, @usernames, or full URLs
// Backend will normalize to canonical format (e.g., @johndoe -> https://twitter.com/johndoe)
const PLATFORM_PATTERNS: Record<LocalSocialPlatform, { pattern: RegExp; hint: string }> = {
  twitter: {
    // Accepts: @username, username, twitter.com/username, x.com/username (with or without protocol/www)
    pattern: /^(@?[a-zA-Z0-9_]+|(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/?)?$/i,
    hint: "@username or full URL",
  },
  instagram: {
    // Accepts: @username, username, instagram.com/username (with or without protocol/www)
    pattern: /^(@?[a-zA-Z0-9_.]+|(https?:\/\/)?(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?)?$/i,
    hint: "@username or full URL",
  },
  youtube: {
    // Accepts: @channel, channel, youtube.com/@channel, youtube.com/channel/ID, youtube.com/c/name
    pattern: /^(@?[a-zA-Z0-9_-]+|(https?:\/\/)?(www\.)?youtube\.com\/(channel\/|c\/|user\/|@)?[a-zA-Z0-9_-]+\/?)?$/i,
    hint: "@channel or full URL",
  },
};

// Platform-specific validation schemas - very permissive, backend handles normalization
const createPlatformSchema = (platform: LocalSocialPlatform) =>
  z.string().refine(
    (val) => {
      if (!val || val.trim() === "") return true;
      return PLATFORM_PATTERNS[platform].pattern.test(val.trim());
    },
    { message: `Enter ${PLATFORM_PATTERNS[platform].hint}` }
  );

const socialLinksSchema = z.object({
  twitter: createPlatformSchema("twitter"),
  instagram: createPlatformSchema("instagram"),
  youtube: createPlatformSchema("youtube"),
});

type SocialLinksFormData = z.infer<typeof socialLinksSchema>;

const SOCIAL_PLATFORMS: { platform: LocalSocialPlatform; placeholder: string }[] = [
  { platform: "twitter", placeholder: "Twitter URL" },
  { platform: "instagram", placeholder: "Instagram URL" },
  { platform: "youtube", placeholder: "Youtube URL" },
];

export function SocialLinksSection({ className }: SocialLinksSectionProps) {
  // Fetch existing social links from API
  const { data: existingSocialLinks = [], isLoading: isFetching } = useSocialLinks();

  // Track whether user has made changes (prevents auto-save on initial load)
  const hasMountedRef = useRef(false);
  // Track the last saved value to prevent duplicate saves
  const lastSavedRef = useRef<string>("");
  // Separate debounce timers for validation and autosave
  const validateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track form methods ref for use in mutation callback
  const methodsRef = useRef<ReturnType<typeof useForm<SocialLinksFormData>> | null>(null);

  const methods = useForm<SocialLinksFormData>({
    resolver: zodResolver(socialLinksSchema),
    mode: "onChange",
    defaultValues: {
      twitter: "",
      instagram: "",
      youtube: "",
    },
  });

  // Keep methodsRef in sync
  methodsRef.current = methods;

  // Mutation with onSuccess to sync normalized URLs back to form
  const bulkUpsertMutation = useBulkUpsertSocialLinks({
    onSuccess: (data) => {
      // Update form with normalized URLs from backend
      if (methodsRef.current && data) {
        const normalizedValues: SocialLinksFormData = {
          twitter: "",
          instagram: "",
          youtube: "",
        };
        data.forEach((link) => {
          const platform = link.platform as LocalSocialPlatform;
          if (platform in normalizedValues && link.url) {
            normalizedValues[platform] = link.url;
          }
        });
        // Update lastSavedRef to prevent re-saving the same data
        lastSavedRef.current = JSON.stringify(normalizedValues);
        // Reset form with normalized values (without triggering validation)
        methodsRef.current.reset(normalizedValues, { keepDirty: false });
      }
    },
  });

  // Delete mutation for clearing individual social links
  const deleteMutation = useDeleteSocialLink();

  // Use refs to store the mutate functions to avoid them being dependencies
  const mutateRef = useRef(bulkUpsertMutation.mutate);
  mutateRef.current = bulkUpsertMutation.mutate;
  const deleteRef = useRef(deleteMutation.mutate);
  deleteRef.current = deleteMutation.mutate;

  // Initialize form from API data
  useEffect(() => {
    if (existingSocialLinks.length > 0) {
      const linksMap: SocialLinksFormData = {
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
      methods.reset(linksMap);
      // Set the last saved value to prevent re-saving the same data
      lastSavedRef.current = JSON.stringify(linksMap);
    }
  }, [existingSocialLinks, methods]);

  // Helper to find existing link by platform
  const getExistingLinkByPlatform = useCallback(
    (platform: LocalSocialPlatform) => {
      return existingSocialLinks.find((link) => link.platform === platform);
    },
    [existingSocialLinks]
  );

  // Watch form changes with separate debounces for validation and autosave
  useEffect(() => {
    const subscription = methods.watch(() => {
      // Skip first mount
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }

      // Clear existing timers
      if (validateTimerRef.current) {
        clearTimeout(validateTimerRef.current);
      }
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      // Debounce validation (200ms)
      validateTimerRef.current = setTimeout(() => {
        methods.trigger();
      }, 200);

      // Debounce autosave (750ms)
      autosaveTimerRef.current = setTimeout(async () => {
        // Trigger validation and check result
        const isValid = await methods.trigger();
        if (!isValid) return;

        const formData = methods.getValues();

        // Check if anything changed from last save
        const currentValue = JSON.stringify(formData);
        if (currentValue === lastSavedRef.current) return;

        // Find platforms to delete (had a saved link, now empty)
        const platformsToDelete = SOCIAL_PLATFORMS.filter(({ platform }) => {
          const existingLink = getExistingLinkByPlatform(platform);
          const currentValue = formData[platform].trim();
          return existingLink && currentValue.length === 0;
        });

        // Delete cleared platforms
        platformsToDelete.forEach(({ platform }) => {
          const existingLink = getExistingLinkByPlatform(platform);
          if (existingLink) {
            deleteRef.current({ socialLinkId: existingLink.id });
          }
        });

        // Convert to API format and save non-empty values
        const socialLinksToSave = SOCIAL_PLATFORMS.filter(
          ({ platform }) => formData[platform].trim().length > 0
        ).map(({ platform }) => ({
          platform,
          url: formData[platform],
        }));

        // Update lastSavedRef before mutations
        lastSavedRef.current = currentValue;

        if (socialLinksToSave.length > 0) {
          mutateRef.current({ socialLinks: socialLinksToSave });
        }
      }, 750);
    });

    return () => {
      subscription.unsubscribe();
      if (validateTimerRef.current) {
        clearTimeout(validateTimerRef.current);
      }
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [methods, getExistingLinkByPlatform]);

  const handleLinkChange = useCallback(
    (platform: LocalSocialPlatform, url: string) => {
      // Don't validate immediately - let the debounced validation handle it
      methods.setValue(platform, url, { shouldDirty: true });
    },
    [methods]
  );

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

  const watchedValues = methods.watch();
  const { errors } = methods.formState;

  return (
    <div className={twMerge("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-base-500">Social Links</h3>
        {(bulkUpsertMutation.isPending || deleteMutation.isPending) && (
          <Loader2 className="w-3 h-3 text-base-300 animate-spin" />
        )}
      </div>

      <div className="space-y-2">
        {SOCIAL_PLATFORMS.map(({ platform, placeholder }) => (
          <SocialLinkInput
            key={platform}
            platform={platform}
            placeholder={placeholder}
            value={watchedValues[platform]}
            onChange={(value) => handleLinkChange(platform, value)}
            error={errors[platform]?.message}
            isSaved={
              existingSocialLinks.some(
                (link) => link.platform === platform && link.url === watchedValues[platform]
              ) && !bulkUpsertMutation.isPending && !deleteMutation.isPending
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
  error?: string;
  isSaved: boolean;
}

function SocialLinkInput({
  platform,
  placeholder,
  value,
  onChange,
  error,
  isSaved,
}: SocialLinkInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const isValid = !error;
  const hasValidContent = isValid && value.trim().length > 0;
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
        value={value}
        onChange={handleChange}
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
      {error && (
        <p className="text-xs text-red-500 mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
