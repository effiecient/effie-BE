const jwt = require("jsonwebtoken");

export function createTokenJWT(payload: any, expiresIn: string) {
  return jwt.sign(payload, process.env.SECRET_KEY, { expiresIn });
}

export function verifyTokenJWT(token: string) {
  return jwt.verify(token, process.env.SECRET_KEY);
}
