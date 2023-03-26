import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";
import { getDB, isAnyUndefined, isRelativePathValid, recursiveCloneDocument, recursiveDeleteDocument, recursiveUpdateDocumentShareConfiguration } from "../../utils";
import { isShareConfiguration } from "../../typeValidator";
import { isAnyDefined } from "../../utils/isAnyDefined";

// example of complete data
// const body = {
//   // MUST HAVE USERNAME PATH and RELATIVE PATH
//   username: "christojeffrey",
//   path: "/",
//   relativePath: "a",
//   // data below is optional. at least one of them must be provided
//   isPinned: false,
//   title: "A",
//   newRelativePath: "b",
//   shareConfiguration: {
//     isShared: true,
//     sharedPrivilege: "read",
//   },
// };

export async function updateFolder(req: VercelRequest, res: VercelResponse) {
  const { username, path, relativePath, title, isPinned, newRelativePath, shareConfiguration } = req.body;
  // validate: must be logged in
  if (req.headers.username === undefined) {
    res.status(401).json({
      status: STATUS_ERROR,
      message: "Unauthorized",
    });
    return;
  }
  // validate: check if username, path, and relativePath is provided
  if (isAnyUndefined(username, path, relativePath)) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body. Username, path, and relativePath must be provided",
    });
    return;
  }
  // validate: check if at least one of the data is provided
  if (!isAnyDefined(isPinned, title, newRelativePath, shareConfiguration)) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body. At least one of the data must be provided (isPinned, title, newRelativePath, shareConfiguration).",
    });
    return;
  }

  if (shareConfiguration !== undefined) {
    // validate: shared config must be type of UpdatedData
    if (!isShareConfiguration(shareConfiguration)) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: "Invalid share configuration.",
      });
      return;
    }
  }
  // validate: check if path start with /
  if (path[0] !== "/") {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid path.",
    });
    return;
  }
  // validate: check if relativePath is valid
  if (newRelativePath !== undefined) {
    if (!isRelativePathValid(newRelativePath)) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: "Invalid newRelativePath.",
      });
      return;
    }
  }
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

  // validate: check if the parent is exist
  if (!parentData.exists) {
    // if folder doesn't exist, break and return error
    res.status(404).json({
      status: STATUS_ERROR,
      message: "Parent not found.",
    });
    return;
  }
  // get the folder
  let folderRef = parentRef.collection("childrens").doc(relativePath);
  let folderData = await folderRef.get();
  // validate: check if the folder is exist
  if (!folderData.exists) {
    res.status(404).json({
      status: STATUS_ERROR,
      message: "Folder not found.",
    });
    return;
  }
  parentData = parentData.data();
  folderData = folderData.data();

  // validate: check if has access. if not the owner, and (the folder is not shared or shared but not with write privilege), return error
  if (req.headers.username !== username && (!folderData.isShared || (folderData.isShared && folderData.sharedPrivilege !== "write"))) {
    res.status(403).json({
      status: STATUS_ERROR,
      message: "Forbidden.",
    });
    return;
  }

  // validate: check if the folder is a folder
  if (folderData.type !== "folder") {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid relativePath. It is not a folder.",
    });
    return;
  }

  // validate: check if the newRelativePath is already exist
  if (newRelativePath !== undefined) {
    if (parentData.childrens[newRelativePath]) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: "Invalid newRelativePath. It is already exist.",
      });
      return;
    }
  }
  // at this point, we have valid parent and folder

  // 1. update the folder
  let updatedFolderData = folderData;
  let updated: any = { isPinned, title, shareConfiguration };
  Object.keys(updated).forEach((key) => {
    if (updated[key] !== undefined) {
      updatedFolderData[key] = updated[key];
    }
  });
  await folderRef.update(updatedFolderData, { merge: true });

  // 2. update the parent. childrens is an object with relativePath as key and data as value
  let updatedChildren = parentData.childrens;
  // delete the old relative path
  delete updatedChildren[relativePath];
  // add the new relative path
  delete updatedFolderData.childrens;
  updatedChildren[newRelativePath !== undefined ? newRelativePath : relativePath] = {
    ...updatedFolderData,
  };
  const updatedParentData = {
    ...parentData,
    childrens: updatedChildren,
  };

  await parentRef.update(updatedParentData, { merge: true });

  // handle update the shared config
  if (shareConfiguration !== undefined) {
    const { isUpdated, error } = await recursiveUpdateDocumentShareConfiguration(parentRef, relativePath, shareConfiguration);
    if (!isUpdated) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: error,
      });
      return;
    }
  }
  // handle new relative path
  if (newRelativePath !== undefined) {
    const { isCloned, error } = await recursiveCloneDocument(parentRef, relativePath, newRelativePath);
    if (!isCloned) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: error,
      });
      return;
    }
    // recursive delete the old relative path
    const { isDeleted, error: deleteError } = await recursiveDeleteDocument(parentRef, relativePath);
    if (!isDeleted) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: deleteError,
      });
      return;
    }
  }

  res.status(200).json({
    status: STATUS_SUCCESS,
    data: updatedFolderData,
  });
}
