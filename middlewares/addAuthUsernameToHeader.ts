import { verifyTokenJWT } from "../utils";

export function addAuthUsernameToHeader(req: any, res: any, next: any) {
  // will check if auth header is present. if yes, add username to header. if no, add undefined to header
  if (!req.headers.authorization) {
    req.headers.username = undefined;
    return next();
  }
  // parse auth header and add username to req
  // try {
  const authHeader = req.headers.authorization;
  verifyTokenJWT(authHeader, (err: any, decoded: any) => {
    if (err) {
      req.headers.username = undefined;
    } else {
      req.headers.username = decoded.username;
    }
  });

  return next();
}
