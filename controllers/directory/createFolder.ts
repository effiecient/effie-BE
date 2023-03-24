import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";
import utils from "../../utils";

//   example data
// const username = "christojeffrey";

// const path = "/";
// const relativePath = "searchEngines";
// const title = "Search Engines";
// const isPinned = false;

export async function createFolder(req: VercelRequest, res: VercelResponse) {
  const { username, path, relativePath, title, isPinned } = req.body;
  if (!username || !relativePath || !title || isPinned === undefined || !path) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body",
    });
    return;
  }

  //   check if path start with /
  if (path[0] !== "/") {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid path",
    });
    return;
  }
  //   get the db
  const { db } = utils.getDB();
  //   get the parent of the link ref
  // turn path from "/" or "/testing"or "/testing/another" ["testing", "another"]
  const pathArray = path.split("/").filter((item: any) => item !== "");
  // get the parent of the link. if it doesn't exist, create it
  const directoryRootRef = db.collection("directories").doc(username);
  let parentRef = directoryRootRef;
  for (let i = 0; i < pathArray.length; i++) {
    const pathItem = pathArray[i];
    const childRef = parentRef.collection("childrens").doc(pathItem);
    parentRef = childRef;
  }

  // read the parent folder, add to field called link. Add to the array
  let parentData = await parentRef.get();
  if (!parentData.exists) {
    res.status(404).json({
      status: STATUS_ERROR,
      message: "Parent not found",
    });
    return;
  }

  parentData = parentData.data();

  // check if parentData object has childrens children
  if (!parentData.childrens) {
    parentData.childrens = {};
  }
  if (parentData.childrens[relativePath]) {
    // this shouldn't happen. he created a duplicate relative path.
    res.status(409).json({
      status: STATUS_ERROR,
      message: "Duplicate relative path",
    });
    return;
  }

  // add the folder to the parent
  parentData.childrens[relativePath] = {
    title,
    isPinned,
    type: "folder",
  };

  // update the parent
  await parentRef.update(parentData, { merge: true });

  // create a new documents inside the childrens collection
  const folderRef = parentRef.collection("childrens").doc(relativePath);

  await folderRef.set({
    title,
    isPinned,
    type: "folder",
  });

  res.status(201).json({
    status: STATUS_SUCCESS,
    data: parentData,
  });
}
