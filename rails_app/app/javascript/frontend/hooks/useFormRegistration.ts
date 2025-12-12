import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useFormRegistry, selectRegister } from "@stores/formRegistry";

export function useFormRegistration(parent: string, methods: UseFormReturn<any>) {
  const register = useFormRegistry(selectRegister);

  useEffect(() => {
    const unregister = register(parent, {
      validate: () => methods.trigger(),
    });
    return unregister;
  }, [parent, methods, register]);
}
