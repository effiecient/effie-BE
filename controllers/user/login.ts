import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDB, getFirebaseAuth } from "../../helper";
import utils from "../../utils";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";

export async function login(req: VercelRequest, res: VercelResponse) {
    // body contains uid
  const { uid } = req.body;
  const accessToken = req.headers.authorization;

  // check if body contains uid
  if (uid === undefined) {
    return res.status(400).json({
      status: STATUS_ERROR,
      message: "Missing uid"
    })}
  else {
    console.log("Testing")
    console.log("uid", uid);
  };

  // check if accessToken exists
  if (accessToken === undefined) {
    return res.status(400).json({
      status: STATUS_ERROR,
      message: "Missing access token",
    });
  }

  // check if token is valid
  const { auth } = getFirebaseAuth();
  let decodedToken : any;
  try {
    decodedToken = await auth.verifyIdToken(accessToken);
    console.log("decodedToken", decodedToken);
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

  const username = await utils.getUsernameById(uid);
  if (username === null) {
    return res.status(400).json({
      status: STATUS_ERROR,
      message: `User ID ${uid} does not have a username`,
    });
  }
  console.log("current username", username);
  
  // if uid has username, make token from uid, username
  // then, return token and username to client
  // if uid does not have username, return error
  const payload = { uid, username };
  const token = await utils.createTokenJWT(payload, "168h");
  res.status(200).json({
    status: STATUS_SUCCESS,
    token: token
  });
}
