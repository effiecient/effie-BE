import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";
import { getDB, isAnyUndefined, isRelativePathValid } from "../../utils";
import { isShareConfiguration } from "../../typeValidator";

//   example data
// const username = "christojeffrey";

// const path = "/";
// const link = "https:bing.com";
// const relativePath = "bing";
// const title = "Bing";
// const isPinned = false;
// const shareConfiguration = {isShared:false}

// TODO: create based on parent share configuration
export async function createLink(req: VercelRequest, res: VercelResponse) {
  // validate: must be logged in to create link
  if (req.headers.username === undefined) {
    res.status(401).json({
      status: STATUS_ERROR,
      message: "Unauthorized",
    });
    return;
  }
  // validate: parse the body
  let { username, link, path, relativePath, title, isPinned, shareConfiguration } = req.body;
  if (isAnyUndefined(username, link, path, relativePath)) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body",
    });
    return;
  }
  // handle default value
  title = title === undefined ? title : relativePath;
  isPinned = isPinned === undefined ? false : isPinned;

  // validate: check if path start with /
  if (path[0] !== "/") {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid path",
    });
    return;
  }
  // validate: prevent invalid characters in relative path
  if (!isRelativePathValid(relativePath)) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid relative path. Only alphanumeric characters and hyphens are allowed.",
    });
    return;
  }
  // validate shareConfiguraiton
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
  // validate: check if parent exists
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
    // validate: this shouldn't happen. he created a duplicate relative path.
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
  parentData.childrens[relativePath] = {
    type: "link",
    isPinned,
    link,
    title,
    shareConfiguration,
  };

  await parentRef.set(parentData, { merge: true });

  // NO LONGER NEEDED. links are now stored in the parent folder, not in a separate document
  // create a new documents inside the childrens collection
  // const linkRef = parentRef.collection("childrens").doc(relativePath);
  // await linkRef.set({
  //   type: "link",
  //   isPinned,
  //   link,
  //   title,
  // });

  // return success
  res.status(201).json({
    status: STATUS_SUCCESS,
    data: parentData,
  });
}
