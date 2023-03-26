import { verifyTokenJWT } from "../utils";

export function addAuthUsernameToHeader(req: any, res: any, next: any) {
  // will check if auth header is present. if yes, add username to header. if no, add undefined to header
  if (!req.headers.authorization) {
    req.headers.username = undefined;
    return next();
  }
  // parse auth header and add username to req
  let decoded;
  try {
    const authHeader = req.headers.authorization;
    decoded = verifyTokenJWT(authHeader);
    req.headers.username = decoded.username;
  } catch (err: any) {
    req.headers.username = undefined;
  }
  return next();
}
