import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";
import utils from "../../utils";

// example of complete data
const body = {
  // MUST HAVE USERNAME PATH and RELATIVE PATH
  username: "christojeffrey",
  path: "/",
  relativePath: "a",
  // data below is optional. at least one of them must be provided
  isPinned: false,
  title: "A",
  newRelativePath: "b",
};

export async function updateFolder(req: VercelRequest, res: VercelResponse) {
  // const { username, path, relativePath, title, isPinned } = req.body;

  // temporary data
  const username = "christojeffrey";
  const path = "/itb";
  const relativePath = "semester-4";
  const isPinned = false;
  const title = "Semester 5";
  const newRelativePath = "semester-5";

  if (!username || !path || !relativePath) {
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

  // at this point, we have valid parent and folder

  folderData = folderData.data();
  parentData = parentData.data();

  // 1. update the folder
  let updatedFolderData = {
    ...folderData,
    isPinned: isPinned ? isPinned : folderData.isPinned,
    title: title ? title : folderData.title,
  };
  await folderRef.update(updatedFolderData, { merge: true });

  // handle new relative path
  if (newRelativePath) {
    // check if new relative path is already exist
    const newFolderRef = parentRef.collection("childrens").doc(newRelativePath);
    const newFolderData = await newFolderRef.get();
    if (newFolderData.exists) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: "Folder already exist.",
      });
      return;
    }
    // update the folder by deleting the old one and creating a new one
    await folderRef.delete();
    await newFolderRef.set(updatedFolderData);
  }

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

  res.status(200).json({
    status: STATUS_SUCCESS,
    data: updatedFolderData,
  });
}
