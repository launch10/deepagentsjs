/**
 * Abstract base class for all registries in the application.
 * Provides common functionality for managing collections of items by ID.
 */
export abstract class BaseRegistry<T extends { id: string }> {
    protected readonly registry: Readonly<Record<string, T>>;
    protected readonly name: string;

    /**
     * Creates a new registry instance.
     * @param registryData The map of all items in the registry.
     * @param name The name of the registry for logging purposes.
     */
    constructor(registryData: Record<string, T>, name: string) {
        this.registry = Object.freeze(registryData);
        this.name = name;
        console.log(`${name} initialized with ${Object.keys(this.registry).length} entries.`);
    }

    /**
     * Retrieves all items from the registry.
     * @returns An array of all items.
     */
    public getAll(): T[] {
        return Object.values(this.registry);
    }

    /**
     * Retrieves an item by its unique ID.
     * @param id The unique identifier.
     * @returns The item or undefined if not found.
     */
    public getById(id: string): T | undefined {
        return this.registry[id];
    }

    /**
     * Checks if an item exists in the registry.
     * @param id The unique identifier.
     * @returns True if the item exists, false otherwise.
     */
    public has(id: string): boolean {
        return id in this.registry;
    }

    /**
     * Gets all IDs in the registry.
     * @returns An array of all IDs.
     */
    public getIds(): string[] {
        return Object.keys(this.registry);
    }

    /**
     * Finds items that match a predicate.
     * @param predicate The function to test each item.
     * @returns An array of matching items.
     */
    public find(predicate: (item: T) => boolean): T[] {
        return Object.values(this.registry).filter(predicate);
    }

    /**
     * Finds the first item that matches a predicate.
     * @param predicate The function to test each item.
     * @returns The first matching item or undefined.
     */
    public findOne(predicate: (item: T) => boolean): T | undefined {
        return Object.values(this.registry).find(predicate);
    }

    /**
     * Gets the count of items in the registry.
     * @returns The number of items.
     */
    public get count(): number {
        return Object.keys(this.registry).length;
    }
}