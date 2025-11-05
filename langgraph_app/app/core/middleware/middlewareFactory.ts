import { type NodeFunction, type NodeMiddlewareType } from "./types";

type InferMiddlewareConfig<T, TState> = T extends (
  node: any,
  config: infer Config
) => any
  ? Config extends { keyFunc?: (state: any) => any }
    ? Omit<Config, 'keyFunc'> & { keyFunc?: (state: TState) => string }
    : Config
  : never;

type MiddlewareConfigMap<TRegistered extends string, TMiddlewares, TState> = {
  [K in TRegistered]?: K extends keyof TMiddlewares 
    ? InferMiddlewareConfig<TMiddlewares[K], TState>
    : never;
};

type MiddlewareConfig<TRegistered extends string, TMiddlewares, TState = any> = MiddlewareConfigMap<TRegistered, TMiddlewares, TState> & {
  only?: TRegistered[];
  except?: TRegistered[];
};

type MiddlewareFn = (node: any, config: any) => any;
export class NodeMiddlewareFactory<
  TRegistered extends string = never,
  TMiddlewares extends Record<string, MiddlewareFn> = {}
> {
  private middlewares: TMiddlewares;

  constructor() {
    this.middlewares = {} as TMiddlewares;
  }

  addMiddleware<
    TName extends string, 
    TMiddleware extends MiddlewareFn
  >(name: TName, middleware: TMiddleware) {
    (this.middlewares as any)[name] = middleware;
    return this as unknown as NodeMiddlewareFactory<TRegistered | TName, TMiddlewares & Record<TName, TMiddleware>>
  }

  use<TState extends Record<string, unknown>>(
    config: MiddlewareConfig<TRegistered, TMiddlewares, TState> = {},
    node: NodeFunction<TState>,
  ): NodeFunction<TState> {
    const middlewaresToApply = this.getMiddlewaresToApply(config);

    return middlewaresToApply.reduceRight(
      (wrappedNode, [name, middleware]) => {
        const middlewareConfig = config[name];
        return middleware(wrappedNode, middlewareConfig);
      },
      node
    );
  }

  private getMiddlewaresToApply(
    config: MiddlewareConfig<TRegistered, TMiddlewares, any>
  ): [TRegistered, NodeMiddlewareType<any>][] {
    const allNames = Object.keys(this.middlewares) as TRegistered[];
    
    let selectedNames = allNames;
    
    if (config.only) {
      selectedNames = allNames.filter(name => config.only!.includes(name));
    }
    
    if (config.except) {
      selectedNames = selectedNames.filter(name => !config.except!.includes(name));
    }
    
    return selectedNames.map(name => [name, this.middlewares[name]!]);
  }
}
 
