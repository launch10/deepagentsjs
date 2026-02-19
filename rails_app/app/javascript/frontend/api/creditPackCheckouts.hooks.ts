import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { CreditPackCheckoutAPIService, type CreditPackCheckoutResponse } from "@rails_api_base";
import { useJwt, useRootPath } from "~/stores/sessionStore";

export type { CreditPackCheckoutResponse } from "@rails_api_base";

export function useCreditPackCheckoutService() {
  const jwt = useJwt();
  const rootPath = useRootPath();
  return useMemo(
    () => new CreditPackCheckoutAPIService({ jwt: jwt ?? "", baseUrl: rootPath ?? "" }),
    [jwt, rootPath]
  );
}

export function useCreditPackCheckout() {
  const service = useCreditPackCheckoutService();

  return useMutation<CreditPackCheckoutResponse, Error, number>({
    mutationFn: (packId) => service.checkout(packId),
  });
}
