import { HonoContext } from '~/utils/honoContext';

export class KV extends HonoContext {
    async get(key: string): Promise<string | null> {
        return this.c.env.DEPLOYS_KV.get(key);
    }

    async put(key: string, value: string): Promise<void> {
        await this.c.env.DEPLOYS_KV.put(key, value);
    }

    async delete(key: string): Promise<void> {
        await this.c.env.DEPLOYS_KV.delete(key);
    }

    async list(prefix: string): Promise<string[]> {
        const list = await this.c.env.DEPLOYS_KV.list({ prefix });
        return list.keys.map(key => key.name);
    }
}