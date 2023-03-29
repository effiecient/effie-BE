import { verifyTokenJWT } from "../../utils";

export default function checkAuth(req: any, res: any) {
  // check whether the auth is valid or not. If valid, return username
  // if not, return 401
  let token;
  if (req.headers.authorization) {
    token = req.headers.authorization;
  } else {
    res.status(401).json({ success: false, message: "No token provided." });
    return;
  }
  let decoded;
  try {
    decoded = verifyTokenJWT(token);
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid token." });
    return;
  }

  // check if environment is the same as the current environment
  if (decoded.environment !== process.env.NODE_ENV) {
    console.log("Invalid token. Environment is not the same.");
    console.log("Token environment: " + decoded.environment);
    console.log("Current environment: " + process.env.NODE_ENV);
    res.status(401).json({ success: false, message: "Invalid token." });
    return;
  }

  if (decoded) {
    if (decoded.photoURL === undefined) {
      res.status(200).json({ success: true, username: decoded.username });
    } else {
      res.status(200).json({ success: true, username: decoded.username, photoURL: decoded.photoURL });
    }
  } else {
    res.status(401).json({ success: false, message: "Invalid token." });
  }
}
