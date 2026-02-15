import { useEffect } from "react";
import { usePage } from "@inertiajs/react";
import { toast } from "sonner";
import type { SharedPageProps } from "~/layouts/site-layout";

/**
 * Bridges Rails flash messages to sonner toasts.
 */
export function useFlashMessages() {
  const props = usePage().props as SharedPageProps;

  useEffect(() => {
    if (!props.flash?.length) return;

    props.flash.forEach((flash) => {
      const title = flash.title || flash.message;
      if (!title) return;

      const options: { description?: string; duration?: number } = {
        duration: 5000,
      };
      if (flash.description) {
        options.description = flash.description;
      }

      switch (flash.type) {
        case "success":
          toast.success(title, options);
          break;
        case "error":
          toast.error(title, options);
          break;
        case "info":
          toast.info(title, options);
          break;
      }
    });
  }, [props.flash]);
}
