const jwt = require('jsonwebtoken');
const secretKey = process.env.SECRET_KEY;

export async function createTokenJWT(payload: any, expiresIn: string) {
  console.log(`creating token with payload ${payload}`)
  return jwt.sign(payload, process.env.SECRET_KEY, { expiresIn });
}