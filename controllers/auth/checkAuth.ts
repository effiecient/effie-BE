import { STATUS_ERROR, STATUS_SUCCESS } from "../../config";
import { createTokenJWT, getFirebaseAuth, verifyTokenJWT } from "../../utils";

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
  let error: any;
  decoded = verifyTokenJWT(token, (err: any, decoded: any) => {
    if (err) {
      error = err;
    }
    return decoded;
  });

  if (error) {
    res.status(401).json({ status: STATUS_ERROR, message: error.message });
    return;
  }

  // check if environment is the same as the current environment
  if (decoded.environment !== process.env.NODE_ENV) {
    console.log("Invalid token. Environment is not the same.");
    console.log(typeof decoded.environment);
    console.log(typeof process.env.NODE_ENV);
    console.log("Token environment: " + decoded.environment);
    console.log("Current environment: " + process.env.NODE_ENV);
    res.status(401).json({ status: STATUS_ERROR, message: "Invalid token." });
    return;
  }
  // get the photoURL based on google uid from firebase auth
  let { auth } = getFirebaseAuth();
  let user = await auth.getUser(decoded.uid);
  let photoURL = user.photoURL;

  // update the token
  let payload: any = { uid: decoded.uid, username: decoded.username, environment: process.env.NODE_ENV };

  const newToken = createTokenJWT(payload, "30d");

  res.status(200).json({ status: STATUS_SUCCESS, data: { username: decoded.username, photoURL: photoURL, token: newToken } });
}
