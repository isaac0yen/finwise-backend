import dotenv from 'dotenv';
dotenv.config();

export const JWT_SECRET: string = process.env.JWT_SECRET || ''
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || ''
