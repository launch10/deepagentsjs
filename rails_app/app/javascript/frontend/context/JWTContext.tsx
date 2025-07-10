import React from 'react';
export interface JWT {
    exp: number;
    iat: number;
    jti: string;
    sub: string;
}

export const JWTContext = React.createContext<JWT | null>(null);
export const useJWT = () => React.useContext(JWTContext);