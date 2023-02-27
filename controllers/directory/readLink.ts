import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDB } from "../../helper";

export async function readLink(req: any, res: VercelResponse) {
  // parse the input and validate
  // read params
  const { username } = req.params;

  //   read /api/directory/username/* path, remove empty strings
  let pathArray = req.params["0"].split("/").filter((path: any) => path !== "");

  const path = "/" + pathArray.join("/");

  // start getting data from firestore
  const { db } = getDB();

  //   get rootRef
  const rootRef = db.collection("directories").doc(username);

  // check if username exists
  const root = await rootRef.get();
  if (!root.exists) {
    res.status(404).json({ success: false, message: "User not found.", path });
    return;
  }

  let fileRef = rootRef;
  // for each path in pathArray, update the fileRef
  pathArray.forEach((relativePath: any) => {
    fileRef = fileRef.collection("childrens").doc(relativePath);
  });

  // check if fileRef exists
  const linkOrFolder = await fileRef.get();
  if (!linkOrFolder.exists) {
    res.status(404).json({ success: false, message: "File not found.", path });
    return;
  }

  // get data
  const linkOrFolderData = linkOrFolder.data();

  // return
  res.json({ success: true, path, data: linkOrFolderData });
}
