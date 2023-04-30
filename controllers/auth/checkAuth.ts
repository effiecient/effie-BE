import { STATUS_ERROR, STATUS_SUCCESS } from "../../config";
import { getFirebaseAuth, verifyTokenJWT } from "../../utils";

export default async function checkAuth(req: any, res: any) {
  // check whether the auth is valid or not. If valid, return username
  // if not, return 401
  let token;
  if (req.headers.authorization) {
    token = req.headers.authorization;
  } else {
    res.status(401).json({ status: STATUS_ERROR, message: "No token provided." });
    return;
  }
  let decoded;
  try {
    decoded = verifyTokenJWT(token);
  } catch (err) {
    res.clearCookie(process.env.VERCEL_ENV === "preview" ? "effieTokenPreview" : "effieToken");
    res.status(401).json({ status: STATUS_ERROR, message: "Invalid token." });
    return;
  }

  // check if environment is the same as the current environment
  if (decoded.environment !== process.env.VERCEL_ENV) {
    console.log("Invalid token. Environment is not the same.");
    console.log("Token environment: " + decoded.environment);
    console.log("Current environment: " + process.env.VERCEL_ENV);
    res.clearCookie(process.env.VERCEL_ENV === "preview" ? "effieTokenPreview" : "effieToken");
    res.status(401).json({ status: STATUS_ERROR, message: "Invalid token." });
    // res.redirect("/logout");
    return;
  }
  // get the photoURL based on google uid from firebase auth
  let { auth } = getFirebaseAuth();
  let user = await auth.getUser(decoded.uid);
  let photoURL = user.photoURL;

  res.status(200).json({ status: STATUS_SUCCESS, data: { username: decoded.username, photoURL: photoURL } });
}
