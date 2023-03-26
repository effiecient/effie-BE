import { STATUS_ERROR } from "../config";
import { verifyTokenJWT } from "../utils";

export function checkAuthExist(req: any, res: any, next: any) {
  // will check if auth header is present. if not, return 401. if yes, add username to header
  if (!req.headers.authorization) {
    return res.status(401).json({ status: STATUS_ERROR, message: "Authorization header is missing." });
  }
  // parse auth header and add username to req
  let decoded;
  try {
    const authHeader = req.headers.authorization;
    decoded = verifyTokenJWT(authHeader);
  } catch (err: any) {
    return res.status(401).json({ status: STATUS_ERROR, message: "Failed to authenticate token." });
  }
  console.log(decoded);
  req.headers.username = decoded.username;
  return next();
}
