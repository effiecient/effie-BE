import { STATUS_ERROR } from "../config";
import { verifyTokenJWT } from "../utils";

export function addAuthUsernameToHeader(req: any, res: any, next: any) {
  // will check if auth header is present. if not, return 401. if yes, add username to header
  if (!req.headers.authorization) {
    req.headers.username = null;
    return next();
  }
  // parse auth header and add username to req
  let decoded;
  try {
    const authHeader = req.headers.authorization;
    decoded = verifyTokenJWT(authHeader);
  } catch (err: any) {
    return res.status(401).json({ status: STATUS_ERROR, message: "Failed to authenticate token." });
  }
  req.headers.username = decoded.username;
  return next();
}
