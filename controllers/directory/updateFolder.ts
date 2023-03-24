import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";
import { getDB, isRelativePathValid, recursiveCloneDocument, recursiveUpdate } from "../../utils";
import { isUpdatedData } from "../../type";

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

  if (!username || !path || !relativePath) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body. Username, path, and relativePath must be provided",
    });
    return;
  }
  console.log(isPinned, title, newRelativePath);
  // check if at least one of the data is provided
  if (isPinned === undefined && title === undefined && newRelativePath === undefined && shareConfiguration === undefined) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body. At least one of the data must be provided (isPinned, title, newRelativePath, shareConfiguration)",
    });
    return;
  }

  if (shareConfiguration) {
    // shared config must be type of UpdatedData
    if (!isUpdatedData({ shareConfiguration })) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: "Invalid body. Shared config must be type of UpdatedData",
      });
      return;
    }
  }
  //   check if path start with /
  if (path[0] !== "/") {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid path",
    });
    return;
  }
  if (newRelativePath) {
    if (!isRelativePathValid(newRelativePath)) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: "Invalid newRelativePath",
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
  if (!folderData.exists) {
    res.status(404).json({
      status: STATUS_ERROR,
      message: "Folder not found.",
    });
    return;
  }
  parentData = parentData.data();
  folderData = folderData.data();
  // check if the folder is a folder
  if (folderData.type !== "folder") {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid relativePath. It is not a folder.",
    });
    return;
  }

  // at this point, we have valid parent and folder

  // 1. update the folder
  let updatedFolderData = {
    ...folderData,
    isPinned: isPinned ? isPinned : folderData.isPinned,
    title: title ? title : folderData.title,
  };
  await folderRef.update(updatedFolderData, { merge: true });

  // 2. update the parent. childrens is an object with relativePath as key and data as value
  let updatedChildren = parentData.childrens;
  // delete the old relative path
  delete updatedChildren[relativePath];
  // add the new relative path
  delete updatedFolderData.childrens;
  updatedChildren[newRelativePath ? newRelativePath : relativePath] = {
    ...updatedFolderData,
  };
  const updatedParentData = {
    ...parentData,
    childrens: updatedChildren,
  };

  await parentRef.update(updatedParentData, { merge: true });

  // handle update the shared config
  if (shareConfiguration) {
    const { isUpdated, error } = await recursiveUpdate(parentRef, relativePath, shareConfiguration);
    if (!isUpdated) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: error,
      });
      return;
    }
  }
  // handle new relative path
  if (newRelativePath) {
    const { isCloned, error } = await recursiveCloneDocument(parentRef, relativePath, newRelativePath);
    if (!isCloned) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: error,
      });
      return;
    }
    // recursive delete the old relative path
  }

  res.status(200).json({
    status: STATUS_SUCCESS,
    data: updatedFolderData,
  });
}
