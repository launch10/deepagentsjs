import { Context } from 'hono';
import { Env } from '~/types';

export class HonoContext {
    protected c: Context<{ Bindings: Env }>;
    constructor(c: Context<{ Bindings: Env }>) {
        this.c = c;
    }
}