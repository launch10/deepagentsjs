import { atom } from 'nanostores';

export const jwtStore = atom<string | null>(null);