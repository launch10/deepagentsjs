import React, { useEffect, useRef } from "react";
import { usePage } from "@inertiajs/react";
import { router } from "@inertiajs/react";
import type { InertiaProps } from "@shared";
import { useBrainstormStore, selectRedirect, selectIsHydrated } from "../../stores/brainstormStore";

type NewBrainstormProps =
  InertiaProps.paths["/projects/new"]["get"]["responses"]["200"]["content"]["application/json"];
type UpdateBrainstormProps =
  InertiaProps.paths["/projects/{uuid}/brainstorm"]["get"]["responses"]["200"]["content"]["application/json"];
type BrainstormProps = NewBrainstormProps | UpdateBrainstormProps;

interface BrainstormHydratorProps {
  children: React.ReactNode;
}

export function BrainstormHydrator({ children }: BrainstormHydratorProps) {
  const { props } = usePage<BrainstormProps>();
  const hydrateFromInertia = useBrainstormStore((s) => s.hydrateFromInertia);
  const clearRedirect = useBrainstormStore((s) => s.clearRedirect);
  const redirect = useBrainstormStore(selectRedirect);
  const isHydrated = useBrainstormStore(selectIsHydrated);
  const project = useBrainstormStore((s) => s.brainstorm.project);

  const hasHydratedRef = useRef(false);

  useEffect(() => {
    hydrateFromInertia(props);
    hasHydratedRef.current = true;
  }, [props, hydrateFromInertia]);

  useEffect(() => {
    if (!redirect || !project?.uuid) return;

    const redirectMap: Record<string, string> = {
      website_builder: `/projects/${project.uuid}/website`,
    };

    const targetPath = redirectMap[redirect];
    if (targetPath) {
      clearRedirect();
      router.visit(targetPath);
    }
  }, [redirect, project?.uuid, clearRedirect]);

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
