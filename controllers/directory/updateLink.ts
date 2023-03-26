import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";
import { getDB, isAnyUndefined, isRelativePathValid } from "../../utils";
import { isAnyDefined } from "../../utils/isAnyDefined";
import { isShareConfiguration } from "../../typeValidator";

// example of complete data
// MUST HAVE USERNAME PATH and RELATIVE PATH
// const username = "christojeffrey";
// const path = "/";
// const relativePath = "bing";
// data below is optional. at least one of them must be provided
// const link = "https://bing.com";
// const title = "Bing";
// const isPinned = false;
// const newRelativePath = "bing2";
// const shareConfiguration: {
//     isShared: true,
//     sharedPrivilege: "read",
//   },
// };

export async function updateLink(req: VercelRequest, res: VercelResponse) {
  const { username, path, relativePath, link, title, isPinned, newRelativePath, shareConfiguration } = req.body;

  // validate: must be logged in
  if (req.headers.username === undefined) {
    res.status(401).json({
      status: STATUS_ERROR,
      message: "Unauthorized.",
    });
    return;
  }

  // validate: check if username, path, and relativePath is provided
  if (isAnyUndefined(username, path, relativePath)) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body. Username, path, and relativePath must be provided.",
    });
    return;
  }

  // validate: check if at least one of the data is provided
  if (!isAnyDefined(isPinned, title, newRelativePath, shareConfiguration)) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body. At least one of the data must be provided (isPinned, title, newRelativePath, link, shareConfiguration).",
    });
    return;
  }

  // validate: check if path start with /
  if (path[0] !== "/") {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid path.",
    });
    return;
  }
  // vadidate: check if newRelativePath is valid
  if (newRelativePath !== undefined) {
    if (!isRelativePathValid(newRelativePath)) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: "Invalid newRelativePath.",
      });
      return;
    }
  }
  // validate: check if shareConfig is valid format
  if (shareConfiguration !== undefined) {
    if (!isShareConfiguration(shareConfiguration)) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: "Invalid share configuration.",
      });
      return;
    }
  }
  // validate body done

  //   get the db
  const { db } = getDB();
  // get the parent of the link ref
  // turn path from "/" or "/testing"or "/testing/another" ["testing", "another"]
  let pathArray = path.split("/").filter((item: any) => item !== "");
  // append relative path to pathArray
  console.log(pathArray);

  const directoryRootRef = db.collection("directories").doc(username);
  let parentRef = directoryRootRef;

  // get parent
  for (let i = 0; i < pathArray.length; i++) {
    const pathItem = pathArray[i];
    const childRef = parentRef.collection("childrens").doc(pathItem);
    parentRef = childRef;
  }
  let parentData = await parentRef.get();
  if (!parentData.exists) {
    // if folder doesn't exist, break and return error
    res.status(404).json({
      status: STATUS_ERROR,
      message: "Parent not found.",
    });
    return;
  }

  parentData = parentData.data();
  let linkData = parentData?.childrens[relativePath];

  // validate: check if link exists
  if (linkData === undefined) {
    res.status(404).json({
      status: STATUS_ERROR,
      message: "Link not found.",
    });
    return;
  }

  // validate: check if has access. if not the owner, and (the folder is not shared or shared but not with read privilege), return error
  if (req.headers.username !== username && (!linkData.isShared || (linkData.isShared && linkData.sharedPrivilege !== "read"))) {
    res.status(403).json({
      status: STATUS_ERROR,
      message: "Forbidden.",
    });
    return;
  }

  // validate: check if relativePath is actually a link
  if (!linkData.link) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid relativePath. It is not a link",
    });
    return;
  }

  // at this point, we have valid parent

  // 1. update the link in the parents children
  let updatedParentData = parentData;
  let updated: any = { link, isPinned, title, shareConfiguration };
  Object.keys(updated).forEach((key) => {
    if (updated[key] !== undefined) {
      updatedParentData.childrens[relativePath][key] = updated[key];
    }
  });

  // handle new relative path.
  if (newRelativePath !== undefined) {
    // check if newRelativePath is valid, which means it doesn't exist in the parent
    if (updatedParentData.childrens[newRelativePath]) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: "Invalid newRelativePath. It already exists in the parent",
      });
      return;
    }
    // if valid, update the parent
    updatedParentData.childrens[newRelativePath] = updatedParentData.childrens[relativePath];
    // delete the old relative path
    delete updatedParentData.childrens[relativePath];
  }

  parentRef.update(updatedParentData, { merge: true });

  res.status(200).json({
    status: STATUS_SUCCESS,
    data: updatedParentData.childrens[newRelativePath] ? updatedParentData.childrens[newRelativePath] : updatedParentData.childrens[relativePath],
  });
}
