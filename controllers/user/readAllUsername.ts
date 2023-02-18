import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDB } from "../../helper";

export async function readAllUsername(req: VercelRequest, res: VercelResponse) {
  // returns all usernames
  const { db } = getDB();

  const userCollection = db.collection("users");
  const usersRef = await userCollection.get();
  if (usersRef.empty === true) {
    res.status(400).send(`No user found`);
  } else {
    const userData = usersRef.docs.map((doc: any) => doc.data());
    res.status(200).send(userData);
  }
}
