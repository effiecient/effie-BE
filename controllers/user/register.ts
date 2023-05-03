import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createTokenJWT, getDB, getFirebaseAuth, getUsernameById } from "../../utils";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";

export async function register(req: VercelRequest, res: VercelResponse) {
  // body contains uid
  const { uid, username, photoURL } = req.body;
  const accessToken = req.headers.authorization;

  // check if body contains uid and username
  if (uid === undefined || username === undefined) {
    return res.status(400).json({
      status: STATUS_ERROR,
      message: "Missing uid or username",
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

  const UIDUsername = await getUsernameById(uid);
  if (UIDUsername) {
    return res.status(400).json({
      status: STATUS_ERROR,
      message: `User ID ${uid} is already registered`,
    });
  }

  const { db } = getDB();

  // google collection inside usrs collection
  const userRef = db.collection("users").doc("index").collection("google");

  const usernameExist = await userRef.where("username", "==", username).get();
  if (usernameExist.empty === false) {
    return res.status(400).json({
      status: STATUS_ERROR,
      message: `Username '${username}' already exists`,
    });
  }

  try {
    if (photoURL !== undefined) {
      await userRef.doc(uid).set({ username, photoURL });
    } else {
      await userRef.doc(uid).set({ username });
    }
  } catch (error) {
    return res.status(500).json({
      status: STATUS_ERROR,
      message: "Internal server error",
    });
  }
  // add to index
  try {
    await db
      .collection("users")
      .doc("index")
      .set(
        {
          google: {
            [uid]: username,
          },
        },
        { merge: true }
      );
  } catch (error) {
    return res.status(500).json({
      status: STATUS_ERROR,
      message: "Internal server error",
    });
  }

  // add root folder
  try {
    await db.collection("directories").doc(username).set({ type: "folder" });
  } catch (error) {
    return res.status(500).json({
      status: STATUS_ERROR,
      message: "Internal server error",
    });
  }
  // make jwt token
  let payload: any = { uid, username, environment: process.env.NODE_ENV };
  if (photoURL !== undefined) {
    payload = { ...payload, photoURL };
  }
  const token = await createTokenJWT(payload, "168h");

  return res.status(200).json({
    status: STATUS_SUCCESS,
    token,
    username,
    message: "User registered",
  });
}
