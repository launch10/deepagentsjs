import { useMemo } from "react";
import { useProjectLogo, useProjectImages } from "@api/uploads.hooks";
import { useWebsite } from "@api/websites.hooks";
import { useSocialLinks } from "@api/socialLinks.hooks";

/**
 * Derived hook that checks if any brand personalizations exist.
 *
 * Note: Subscribes to useProjectLogo, useProjectImages, useWebsite,
 * and useSocialLinks queries. Component will re-render when any of
 * these change.
 */
export function useHasAnyPersonalizations(): boolean {
  const { data: logos } = useProjectLogo();
  const { data: images } = useProjectImages();
  const { data: website } = useWebsite();
  const { data: socialLinks } = useSocialLinks();

  return useMemo(() => {
    const hasLogo = (logos?.length ?? 0) > 0;
    const hasTheme = website?.theme_id != null;
    const hasSocialLinks = (socialLinks?.length ?? 0) > 0;
    const hasImages = (images?.length ?? 0) > 0;
    return hasLogo || hasTheme || hasSocialLinks || hasImages;
  }, [logos, website?.theme_id, socialLinks, images]);
}
