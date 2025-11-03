/**
 * A type alias for a standard TypeScript method decorator function.
 */
export type MethodDecorator = (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
) => PropertyDescriptor;

/**
 * A utility for composing multiple method decorators in a clear, declarative "middleware" or "onion" pattern.
 */
export class MiddlewareChain {
    /**
     * Applies a series of decorators to a method descriptor.
     * The decorators are applied in the order they appear in the array,
     * meaning the first decorator in the array becomes the outermost layer of the "onion".
     *
     * @param decorators An array of method decorators to apply.
     * @param target The target object for the decorator.
     * @param propertyKey The name of the property being decorated.
     * @param descriptor The property descriptor for the method.
     * @returns The final, composed PropertyDescriptor after all decorators have been applied.
     *
     * @example
     * return MiddlewareChain.decorate([
     *   withOutermostLayer, // Executes first
     *   withMiddleLayer,
     *   withInnermostLayer  // Executes last, right before the original method
     * ], target, propertyKey, descriptor);
     */
    public static decorate(
        decorators: MethodDecorator[],
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ): PropertyDescriptor {
        // We use `reduceRight` to apply the decorators.
        // It iterates from the end of the array to the beginning.
        // This means the last decorator in the array (`withCaching`) is the first to wrap the original descriptor.
        // The first decorator (`withInterrupt`) is the last to be applied, making it the outermost wrapper.
        //
        // Example: `[A, B, C]` becomes `A(B(C(originalDescriptor)))`.
        return decorators.reduceRight(
            (currentDescriptor, decorator) => decorator(target, propertyKey, currentDescriptor),
            descriptor
        );
    }
}