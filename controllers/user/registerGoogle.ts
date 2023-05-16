import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createTokenJWT, getDB, getFirebaseAuth, getUsernameById } from "../../utils";
import { STATUS_SUCCESS, STATUS_ERROR, FE_TOP_LEVEL_DOMAIN, BLACKLISTED_USERNAMES, FE_DOMAIN } from "../../config";

export async function registerGoogle(req: VercelRequest, res: any) {
  // print cookie if there is any
  console.log("req.cookies", req.cookies);
  // get name from cookie
  console.log("req.cookies.name", req.cookies.name);
  // temporary
  res.cookie("name", "tobi");
  // res.cookie("rememberme", "1", { expires: new Date(Date.now() + 900000), httpOnly: true });

  // res.cookie("token", "TOKENljasdfljdsa", {
  //   domain: `example.com`,
  //   maxAge: 365 * 24 * 60 * 60 * 1000,
  //   sameSite: "none",
  //   secure: true,
  //   path: "/",
  //   withCredentials: true,
  // });

  // expose set cookie header
  res.status(200).json({
    status: STATUS_SUCCESS,
  });

  return;
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

  // set token to cookie
  // path=/; domain=${FE_DOMAIN}.${FE_TOP_LEVEL_DOMAIN};expires=${new Date(
  //     new Date().getTime() + 365 * 24 * 60 * 60 * 1000
  // ).toUTCString()};`;
  res.cookie("token", token, {
    domain: `${FE_DOMAIN}.${FE_TOP_LEVEL_DOMAIN}`,
    maxAge: 365 * 24 * 60 * 60 * 1000,
    sameSite: "none",
    secure: false,
    path: "/",
  });

  res.status(200).json({
    status: STATUS_SUCCESS,
    data: { token, username, photoURL },
  });
}
