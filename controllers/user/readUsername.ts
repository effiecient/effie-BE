import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDB } from "../../helper";

export async function readUsername(req: VercelRequest, res: VercelResponse) {
  // returns username for a given uid

  const { db } = getDB();
  const { uid = "example" } = req.query;

  const userCollection = db.collection("users");
  const usernameExist = await userCollection.where("uid", "==", uid).get();
  if (usernameExist.empty === true) {
    res.status(400).send(`User ID '${uid}' does not have a username`);
  } else {
    const userData = usernameExist.docs[0].data();
    res.status(200).send(userData);
  }
}
