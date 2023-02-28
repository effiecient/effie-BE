import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDB, getFirebaseAuth } from "../../helper";
import utils from "../../utils";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";

export async function register(req: VercelRequest, res: VercelResponse) {
  // body contains uid
  const { uid, username } = req.body;
  const accessToken = req.headers.authorization;

  // check if body contains uid and username
  if (uid === undefined || username === undefined) {
    return res.status(400).json({
      status: STATUS_ERROR,
      message: "Missing uid or username"
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

  if (decodedToken.uid !== uid) {
    return res.status(401).json({
      status: STATUS_ERROR,
      message: "Unauthorized"
    });
  }

  const { db } = getDB();

  const userRef = db.collection("users");

  const usernameExist = await userRef.where("username", "==", username).get();
  if (usernameExist.empty === false) {
    return res.status(400).json({
      status: STATUS_ERROR,
      message: `Username '${username}' already exists`
    });
  }

  // if uid has username, make token from uid, username, and access token

  // then, return token and username to client
    
}
