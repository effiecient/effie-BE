import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDB } from "../../helper";

export async function deleteUsername(req: VercelRequest, res: VercelResponse) {
  // deletes username for a given uid
  const { db } = getDB();
  const { uid } = req.body;
  if (uid === undefined) {
    res.status(400).send("Missing uid");
    return;
  }

  const userCollection = db.collection("users");
  const userRef = userCollection.doc(uid);
  const doc = await userRef.get();
  if (!doc.exists) {
    res.status(400).send(`User ID '${uid}' not found`);
  } else {
    await userRef.delete();
    res.status(200).send(`Username for user ID '${uid}' deleted`);
  }
}
