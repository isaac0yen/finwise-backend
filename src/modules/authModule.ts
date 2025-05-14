
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { JWT_SECRET } from '../config/config';
export const Token = {  sign: (payload: JwtPayload, expiresInDuration: SignOptions['expiresIn'] = '1d'): string => {
    const options = {
      expiresIn: expiresInDuration
    };
 
    return jwt.sign(payload, JWT_SECRET, options);
  },

  verify: (token: string): unknown => {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
};
