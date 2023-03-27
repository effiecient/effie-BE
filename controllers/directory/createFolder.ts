import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_SUCCESS, STATUS_ERROR } from "@/config";
import { getDB, isAnyUndefined, isRelativePathValid } from "@/utils";
import { isShareConfiguration } from "@/typeValidator";

//   example data
// TODO: create a type for req.body
// const username = "christojeffrey";

// const path = "/";
// const relativePath = "searchEngines";
// const title = "Search Engines";
// const isPinned = false;
// shareConfiguration={isShared:false}

// TODO: create share configuration based on parent share configuration
// TODO: handle body validation better. for example, making sure title is string. https://github.com/icebob/fastest-validator
export async function createFolder(req: VercelRequest, res: VercelResponse) {
  // validate: is logged in
  if (req.headers.username === undefined) {
    res.status(401).json({
      status: STATUS_ERROR,
      message: "Unauthorized",
    });
    return;
  }
  // validate: body
  let { username, path, relativePath, title, isPinned, shareConfiguration } = req.body;
  if (isAnyUndefined(username, path, relativePath)) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body",
    });
    return;
  }
  // handle default value
  title = title === undefined ? relativePath : title;
  isPinned = isPinned === undefined ? false : isPinned;

  // validate: check if path start with /
  if (path[0] !== "/") {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid path",
    });
    return;
  }
  // validate: check relative path is valid
  if (!isRelativePathValid(relativePath)) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid relative path. Spaces are not allowed",
    });
    return;
  }
  // validate: check if shareConfiguration valid
  if (shareConfiguration !== undefined) {
    if (!isShareConfiguration(shareConfiguration)) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: "Invalid share configuration.",
      });
      return;
    }
  }

  //   get the db
  const { db } = getDB();
  // get the parent of the link ref
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
  // validate: if the user is not the owner and (the parent isShared = false or (isShared = true and doesn't have the privilage to write))
  // then not permited
  if (req.headers.username !== username && (!parentData.isShared || (parentData.isShared && parentData.sharedPrivilege !== "write"))) {
    res.status(403).json({
      status: STATUS_ERROR,
      message: "Forbidden.",
    });
    return;
  }
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
  // if req.body has shareConfig, use it. else if parent has shareConfig, use it. else, {isShared:false}
  if (shareConfiguration !== undefined) {
  } else if (parentData.shareConfiguration) {
    shareConfiguration = parentData.shareConfiguration;
  } else {
    shareConfiguration = { isShared: false };
  }

  const folderData = {
    title,
    isPinned,
    type: "folder",
    shareConfiguration,
  };

  // add the folder to the parent
  parentData.childrens[relativePath] = folderData;

  // update the parent
  await parentRef.update(parentData, { merge: true });

  // create a new documents inside the childrens collection
  const folderRef = parentRef.collection("childrens").doc(relativePath);

  await folderRef.set(folderData);

  res.status(201).json({
    status: STATUS_SUCCESS,
    data: folderData,
  });
}
