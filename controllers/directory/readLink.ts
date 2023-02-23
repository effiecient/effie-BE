import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDB } from "../../helper";

export async function readLink(req: any, res: VercelResponse) {
  // parse the input and validate
  // read params
  const { username } = req.params;
  console.log(username);
  //   read /api/directory/username/* path
  const pathArray = req.params["0"].split("/");
  console.log(pathArray);

  const { db } = getDB();

  //   get fileRef
  const rootRef = db.collection("directories").doc(username);
  //   const fileRef = pathArray.reduce((acc: any, relativePath: any) => {
  //     return acc.collection("childrens").doc(relativePath);
  //   }, rootRef);

  const fileRef = rootRef.collection("childrens").doc("searchEngines");

  //   read the fileRef
  const file = await fileRef.get();
  if (!file.exists) {
    res.status(404).json({ success: false, message: "File not found." });
    return;
  }
  const fileData = file.data();

  res.json({ success: true, message: "readLink", fileData });
}
