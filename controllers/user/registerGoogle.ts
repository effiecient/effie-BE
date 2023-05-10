import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createTokenJWT, getDB, getFirebaseAuth, getUsernameById } from "../../utils";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";
const BLACKLISTED_USERNAMES = [
  "admin",
  "administrator",
  "root",
  "superuser",
  "su",
  "moderator",
  "mod",
  "owner",
  "staff",
  "support",
  "help",
  "info",
  "contact",
  "about",
  "terms",
  "privacy",
  "cookie",
  "cookies",
  "faq",
  "guidelines",
  "guideline",
  "rules",
  "rule",
  "tos",
  "legal",
  "license",
  "licensing",
  "licence",
  "licencing",
  "licenceing",
  "api",
  "undefined",
];
export async function registerGoogle(req: VercelRequest, res: VercelResponse) {
  // body contains uid
  const { uid, username } = req.body;
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
  // check if username is blacklisted
  if (BLACKLISTED_USERNAMES.includes(username.toLowerCase())) {
    return res.status(400).json({
      status: STATUS_ERROR,
      message: `Username '${username}' is not allowed`,
    });
  }

  const { db } = getDB();

  const userRef = db.collection("users").doc("index").collection("google");

  const usernameExist = await userRef.where("username", "==", username).get();
  if (usernameExist.empty === false) {
    return res.status(400).json({
      status: STATUS_ERROR,
      message: `Username '${username}' already exists`,
    });
  }

  try {
    await userRef.doc(uid).set({ username });
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

  // make jwt token
  // get the photoURL based on google uid from firebase auth
  let user = await auth.getUser(uid);
  let photoURL = user.photoURL;
  let payload: any = { uid, username, environment: process.env.NODE_ENV };
  const token = await createTokenJWT(payload, "168h");

  // create user directory
  let tree = {};
  // create root document with generated ID
  const rootRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc();
  const rootId = rootRef.id;
  let dateRegisterHappen = new Date();
  const rootData = {
    id: rootId,
    type: "folder",
    title: "root",
    isPinned: false,
    publicAccess: "none",
    personalAccess: [],
    createdAt: dateRegisterHappen,
    lastModified: dateRegisterHappen,
    lastModifiedBy: username,
    linkCount: 0,
    folderCount: 0,
    children: {},
  };
  await rootRef.set(rootData);
  tree = {
    root: {
      id: rootId,
      type: "folder",
      children: {},
    },
  };
  const userDirectoryRef = db.collection("linked-directories").doc(username);
  await userDirectoryRef.set({ tree });
  res.status(200).json({
    status: STATUS_SUCCESS,
    data: { token, username, photoURL },
  });
}
