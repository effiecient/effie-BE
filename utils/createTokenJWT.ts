import { sign } from 'jsonwebtoken';

const secretKey = process.env.SECRET_KEY;

function createTokenJWT(payload: any, secretKey: string, expiresIn: string) {
  return sign(payload, secretKey, { expiresIn });
}