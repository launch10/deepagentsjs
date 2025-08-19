import { R2ObjectBody } from '@cloudflare/workers-types';
import { HonoContext } from '~/utils/honoContext';

export class R2 extends HonoContext {
    async get(key: string): Promise<R2ObjectBody | null> {
        return this.c.env.DEPLOYS_R2.get(key);
    }

    async put(key: string, value: string): Promise<void> {
        await this.c.env.DEPLOYS_R2.put(key, value);
    }

    async delete(key: string): Promise<void> {
        await this.c.env.DEPLOYS_R2.delete(key);
    }
}