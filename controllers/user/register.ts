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

  const userRef = db.collection("users");

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
  // TODO: clean console.log
  console.log("payload", payload);
  const token = await createTokenJWT(payload, "168h");

  // create user directory
  let tree = {};
  // create root document with generated ID
  const rootRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc();
  const rootId = rootRef.id;
  const rootData = {
    id: rootId,
    type: "folder",
    title: "root",
    isPinned: false,
    publicAccess: "none",
    personalAccess: [],
    createdOn: new Date(),
    lastModified: new Date(),
    lastModifiedBy: req.headers.username,
    linkCount: 0,
    folderCount: 0,
    children: {},
  };
  await rootRef.set(rootData);
  tree = {
    root: {
      id: rootId,
      type: "folder",
    },
  };
  const userDirectoryRef = db.collection("linked-directories").doc(username);
  await userDirectoryRef.set({ tree });

  return res.status(200).json({
    status: STATUS_SUCCESS,
    token,
    username,
    message: "User registered",
  });
}
