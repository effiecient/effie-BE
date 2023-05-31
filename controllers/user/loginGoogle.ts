import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createTokenJWT, getDB, getFirebaseAuth, getUsernameById } from "../../utils";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";

export async function loginGoogle(req: VercelRequest, res: VercelResponse) {
  // body contains uid
  const { uid } = req.body;
  const accessToken = req.headers.authorization;
  // check if body contains uid
  if (uid === undefined) {
    return res.status(400).json({
      status: STATUS_ERROR,
      message: "Missing uid",
    });
  }

  // check if accessToken exists
  if (accessToken === undefined) {
    return res.status(400).json({
      status: STATUS_ERROR,
      message: "Missing access token",
    });
  }

  // check if token is valid
  const { auth } = getFirebaseAuth();
  let decodedToken: any;
  try {
    decodedToken = await auth.verifyIdToken(accessToken);
  } catch (error) {
    return res.status(401).json({
      status: STATUS_ERROR,
      message: "Unauthorized",
    });
  }

  if (decodedToken.uid !== uid) {
    return res.status(401).json({
      status: STATUS_ERROR,
      message: "Unauthorized",
    });
  }

  const username = await getUsernameById(uid);
  if (username === null) {
    return res.status(400).json({
      status: STATUS_ERROR,
      message: `User have not registered. Please register first`,
    });
  }

  // make jwt token
  let payload: any = { uid, username, environment: process.env.NODE_ENV };

  const token = createTokenJWT(payload, "30d");
  // get the photoURL based on google uid from firebase auth
  let user = await auth.getUser(uid);
  let photoURL = user.photoURL;
  res.status(200).json({
    status: STATUS_SUCCESS,
    data: { token, username, photoURL },
  });
}
