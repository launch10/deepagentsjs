import { Context } from 'hono';
import { Env } from '~/types';
import { HonoContext } from '~/utils/honoContext';
import { KV, R2 } from './cloudflare';

export class CloudflareContext extends HonoContext {
    kv: KV;
    r2: R2;

    constructor(c: Context<{ Bindings: Env }>) {
        super(c);
        this.kv = new KV(c);
        this.r2 = new R2(c);
    }
}