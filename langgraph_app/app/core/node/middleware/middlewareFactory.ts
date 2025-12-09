import { type NodeFunction, type NodeMiddlewareType } from "../types";
import type { CoreGraphState } from "@state";

type InferMiddlewareConfig<T, TState> = T extends (node: any, config: infer Config) => any
  ? Config extends { keyFunc?: (state: any) => any }
    ? Omit<Config, "keyFunc"> & { keyFunc?: (state: TState) => string }
    : Config
  : never;

type MiddlewareConfigMap<TRegistered extends string, TMiddlewares, TState> = {
  [K in TRegistered]?: K extends keyof TMiddlewares
    ? InferMiddlewareConfig<TMiddlewares[K], TState>
    : never;
};

type MiddlewareConfig<TRegistered extends string, TMiddlewares, TState = any> = MiddlewareConfigMap<
  TRegistered,
  TMiddlewares,
  TState
> & {
  only?: TRegistered[];
  except?: TRegistered[];
};

type MiddlewareFn = (node: any, config: any) => any;
export class NodeMiddlewareFactory<
  TRegistered extends string = never,
  TMiddlewares extends Record<string, MiddlewareFn> = {},
> {
  private middlewares: TMiddlewares;

  constructor() {
    this.middlewares = {} as TMiddlewares;
  }

  addMiddleware<TName extends string, TMiddleware extends MiddlewareFn>(
    name: TName,
    middleware: TMiddleware
  ) {
    (this.middlewares as any)[name] = middleware;
    return this as unknown as NodeMiddlewareFactory<
      TRegistered | TName,
      TMiddlewares & Record<TName, TMiddleware>
    >;
  }

  // Overload signatures
  use<TState extends CoreGraphState>(node: NodeFunction<TState>): NodeFunction<TState>;

  use<TState extends CoreGraphState>(
    config: MiddlewareConfig<TRegistered, TMiddlewares, TState>,
    node: NodeFunction<TState>
  ): NodeFunction<TState>;

  // Implementation signature
  use<TState extends CoreGraphState>(
    configOrNode: MiddlewareConfig<TRegistered, TMiddlewares, TState> | NodeFunction<TState>,
    node?: NodeFunction<TState>
  ): NodeFunction<TState> {
    // Determine which overload was called
    const config =
      typeof configOrNode === "function"
        ? ({} as MiddlewareConfig<TRegistered, TMiddlewares, TState>)
        : configOrNode;
    const actualNode = typeof configOrNode === "function" ? configOrNode : node!;

    const middlewaresToApply = this.getMiddlewaresToApply(config);

    return middlewaresToApply.reduceRight((wrappedNode, [name, middleware]) => {
      const middlewareConfig = config[name];
      return middleware(wrappedNode, middlewareConfig);
    }, actualNode);
  }

  private getMiddlewaresToApply(
    config: MiddlewareConfig<TRegistered, TMiddlewares, any>
  ): [TRegistered, NodeMiddlewareType<any>][] {
    const allNames = Object.keys(this.middlewares) as TRegistered[];

    let selectedNames = allNames;

    if (config.only) {
      selectedNames = allNames.filter((name) => config.only!.includes(name));
    }

    if (config.except) {
      selectedNames = selectedNames.filter((name) => !config.except!.includes(name));
    }

    return selectedNames.map((name) => [name, this.middlewares[name]!]);
  }
}
