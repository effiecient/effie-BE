import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDB } from "../../helper";

export async function updateUsername(req: VercelRequest, res: VercelResponse) {
  // updates username for a given uid
  const { db } = getDB();
  const { uid, username } = req.body;
  if (uid === undefined || username === undefined) {
    res.status(400).send("Missing uid or username");
    return;
  }

  const userCollection = db.collection("users");
  const userRef = userCollection.doc(uid);
  const doc = await userRef.get();
  if (!doc.exists) {
    res.status(400).send(`User ID '${uid}' not found`);
  } else {
    await userRef.update({ username: username });
    res.status(200).send(`Username for user ID '${uid}' updated to '${username}'`);
  }
}
