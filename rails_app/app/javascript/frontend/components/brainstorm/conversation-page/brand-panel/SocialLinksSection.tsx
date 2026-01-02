import { useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, Check, Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { useDebouncedCallback } from "use-debounce";
import {
  useSocialLinks,
  useBulkUpsertSocialLinks,
  useDeleteSocialLink,
} from "@api/socialLinks.hooks";

interface SocialLinksSectionProps {
  className?: string;
}

// Local platforms we support in the UI
type LocalSocialPlatform = "twitter" | "instagram" | "youtube";

// Flexible validation - accepts usernames, @usernames, or full URLs
// Backend will normalize to canonical format (e.g., @johndoe -> https://twitter.com/johndoe)
const PLATFORM_PATTERNS: Record<LocalSocialPlatform, { pattern: RegExp; hint: string }> = {
  twitter: {
    pattern: /^(@?[a-zA-Z0-9_]+|(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/?)?$/i,
    hint: "@username or full URL",
  },
  instagram: {
    pattern: /^(@?[a-zA-Z0-9_.]+|(https?:\/\/)?(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?)?$/i,
    hint: "@username or full URL",
  },
  youtube: {
    pattern: /^(@?[a-zA-Z0-9_-]+|(https?:\/\/)?(www\.)?youtube\.com\/(channel\/|c\/|user\/|@)?[a-zA-Z0-9_-]+\/?)?$/i,
    hint: "@channel or full URL",
  },
};

// Platform-specific validation schemas
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

/** Convert API response to form data */
function linksToFormData(
  links: Array<{ platform?: string; url?: string }>
): SocialLinksFormData {
  const result: SocialLinksFormData = { twitter: "", instagram: "", youtube: "" };
  links.forEach((link) => {
    const platform = link.platform as LocalSocialPlatform | undefined;
    if (platform && platform in result && link.url) {
      result[platform] = link.url;
    }
  });
  return result;
}

export function SocialLinksSection({ className }: SocialLinksSectionProps) {
  // Fetch existing social links from API
  const { data: existingLinks = [], isLoading, isSuccess } = useSocialLinks();

  // Track hydration to prevent overwriting user input during initial load
  const hasHydratedRef = useRef(false);

  // Keep a ref to existingLinks for use in debounced callback (avoids stale closure)
  const existingLinksRef = useRef(existingLinks);
  existingLinksRef.current = existingLinks;

  const methods = useForm<SocialLinksFormData>({
    resolver: zodResolver(socialLinksSchema),
    mode: "onChange",
    defaultValues: { twitter: "", instagram: "", youtube: "" },
  });

  // Mutations
  const bulkUpsertMutation = useBulkUpsertSocialLinks({
    onSuccess: (data) => {
      // Sync normalized URLs back to form without triggering autosave
      if (data) {
        const normalizedValues = linksToFormData(data);
        methods.reset(normalizedValues, { keepDirty: false });
      }
    },
  });
  const deleteMutation = useDeleteSocialLink();

  // Hydrate form exactly once after query succeeds
  useEffect(() => {
    if (isSuccess && !hasHydratedRef.current) {
      hasHydratedRef.current = true;
      methods.reset(linksToFormData(existingLinks));
    }
  }, [isSuccess, existingLinks, methods]);

  // Debounced autosave - saves 750ms after last change
  const debouncedSave = useDebouncedCallback(async () => {
    const isValid = await methods.trigger();
    if (!isValid) return;

    const formData = methods.getValues();
    const currentLinks = existingLinksRef.current;
    const savedData = linksToFormData(currentLinks);

    // Check if anything actually changed
    const hasChanges = SOCIAL_PLATFORMS.some(
      ({ platform }) => formData[platform].trim() !== savedData[platform]
    );
    if (!hasChanges) return;

    // Find links to save (non-empty, valid)
    const linksToSave = SOCIAL_PLATFORMS.filter(({ platform }) => {
      const value = formData[platform].trim();
      return value.length > 0 && PLATFORM_PATTERNS[platform].pattern.test(value);
    }).map(({ platform }) => ({
      platform,
      url: formData[platform].trim(),
    }));

    // Find links to delete (had a saved link, now empty)
    const linksToDelete = currentLinks.filter((link) => {
      const platform = link.platform as LocalSocialPlatform;
      return platform in formData && !formData[platform]?.trim();
    });

    // Execute mutations
    const promises: Promise<unknown>[] = [];

    if (linksToSave.length > 0) {
      promises.push(bulkUpsertMutation.mutateAsync({ socialLinks: linksToSave }));
    }

    linksToDelete.forEach((link) => {
      promises.push(deleteMutation.mutateAsync({ socialLinkId: link.id }));
    });

    await Promise.all(promises);
  }, 750);

  // Watch form changes and trigger debounced save
  useEffect(() => {
    const subscription = methods.watch(() => {
      // Only autosave after initial hydration
      if (hasHydratedRef.current) {
        debouncedSave();
      }
    });
    return () => subscription.unsubscribe();
  }, [methods, debouncedSave]);

  if (isLoading) {
    return (
      <div className={twMerge("space-y-2", className)} data-testid="social-links">
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
    <div className={twMerge("space-y-2", className)} data-testid="social-links">
      <h3 className="text-sm font-semibold text-base-500">Social Links</h3>

      <div className="space-y-2">
        {SOCIAL_PLATFORMS.map(({ platform, placeholder }) => {
          const currentValue = watchedValues[platform];
          const savedValue = existingLinks.find((link) => link.platform === platform)?.url;
          // Show checkmark if current value matches saved value (per-input, not global)
          const isSaved = currentValue.trim() === (savedValue ?? "");

          return (
            <SocialLinkInput
              key={platform}
              platform={platform}
              placeholder={placeholder}
              value={currentValue}
              onChange={(value) => methods.setValue(platform, value, { shouldDirty: true })}
              error={errors[platform]?.message}
              isSaved={isSaved}
            />
          );
        })}
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
