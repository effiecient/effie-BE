import utils from "../../utils";

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
    decoded = utils.verifyTokenJWT(token);
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid token." });
    return;
  }

  if (decoded) {
    res.status(200).json({ success: true, username: decoded.username });
  } else {
    res.status(401).json({ success: false, message: "Invalid token." });
  }
}
