import { useState, useCallback } from "react";
import { Link } from "lucide-react";
import { twMerge } from "tailwind-merge";
import {
  useBrandPersonalizationStore,
  selectSocialLinks,
} from "@context/BrandPersonalizationProvider";
import type { SocialPlatform } from "@stores/brandPersonalization";

interface SocialLinksSectionProps {
  className?: string;
}

const SOCIAL_PLATFORMS: { platform: SocialPlatform; placeholder: string }[] = [
  { platform: "twitter", placeholder: "Twitter URL" },
  { platform: "instagram", placeholder: "Instagram URL" },
  { platform: "youtube", placeholder: "Youtube URL" },
];

export function SocialLinksSection({ className }: SocialLinksSectionProps) {
  const socialLinks = useBrandPersonalizationStore(selectSocialLinks);
  const setSocialLink = useBrandPersonalizationStore((s) => s.setSocialLink);

  return (
    <div className={twMerge("space-y-2", className)}>
      <h3 className="text-sm font-semibold text-base-500">Social Links</h3>

      <div className="space-y-2">
        {SOCIAL_PLATFORMS.map(({ platform, placeholder }) => (
          <SocialLinkInput
            key={platform}
            platform={platform}
            placeholder={placeholder}
            value={socialLinks[platform]}
            onChange={(value) => setSocialLink(platform, value)}
          />
        ))}
      </div>

      <p className="text-xs text-base-300">All fields are optional</p>
    </div>
  );
}

interface SocialLinkInputProps {
  platform: SocialPlatform;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

function SocialLinkInput({ platform, placeholder, value, onChange }: SocialLinkInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isValid, setIsValid] = useState(true);

  const validateUrl = (url: string): boolean => {
    if (!url) return true; // Empty is valid (optional)
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    // Clear invalid state while typing
    if (!isValid) {
      setIsValid(true);
    }
  }, [isValid]);

  const handleBlur = useCallback(() => {
    const valid = validateUrl(localValue);
    setIsValid(valid);
    if (valid) {
      onChange(localValue);
    }
  }, [localValue, onChange]);

  return (
    <div className="relative">
      <div className="absolute left-2 top-1/2 -translate-y-1/2">
        <Link className="w-4 h-4 text-base-300" />
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
