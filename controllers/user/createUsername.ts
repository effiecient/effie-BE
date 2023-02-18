import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDB } from "../../helper";

export async function createUsername(req: VercelRequest, res: VercelResponse) {
  // creates username for a given uid
  const { db } = getDB();
  const { uid, username } = req.body;
  if (uid === undefined || username === undefined) {
    res.status(400).send("Missing uid or username");
    return;
  }
  const userCollection = db.collection("users");
  const userRef = userCollection.doc(uid);
  const uidExist = await userCollection.where("uid", "==", uid).get();
  const usernameExist = await userCollection.where("username", "==", username).get();
  if (uidExist.empty === false) {
    res.status(400).send(`User ID '${uid}' already has a username`);
  } else if (usernameExist.empty === false) {
    res.status(400).send(`Username '${username}' already exists`);
  } else {
    await userRef.set({ uid: uid, username: username });
    res.status(200).send(`Username '${username}' for user ID '${uid}' created`);
  }
}
