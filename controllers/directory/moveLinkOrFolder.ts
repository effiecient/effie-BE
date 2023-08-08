import type { VercelRequest, VercelResponse } from "@vercel/node";
import { flattenDataInTree, getDB, getLastIdInPathFromTree, getParentIdAndDataIdFromTree, getUsersTree, isAnyUndefined, isRelativePathFreeInTree, validateBody } from "../../utils";
import { isAnyDefined } from "../../utils/isAnyDefined";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";

export async function moveLinkOrFolder(req: any, res: VercelResponse) {
  // 1. validate input: header and body
  // validate: check if loggedin
  if (req.headers.username === undefined) {
    req.headers.username = "unknown";
  }

  // 2. parse the input. input: username, path
  // read params
  const { username } = req.params;

  // read /api/directory/username/* path, remove empty strings
  let pathArray = req.params["0"].split("/").filter((path: any) => path !== "");

  const fullPath = pathArray.join("/");
  //   split the last
  const path = "/" + fullPath.split("/").slice(0, -1).join("/");
  const relativePath = fullPath.split("/").slice(-1)[0];

  //   read body
  const { newPath } = req.body;
  // validate: check if at least one of the data is provided
  if (!isAnyDefined(newPath)) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body. At least one of the data must be provided. check docs for more info.",
    });
    return;
  }
  let errValidate = await validateBody({ username, path, newPath });
  if (errValidate !== undefined) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: errValidate,
    });
    return;
  }
  // validate body done

  // 3. validate based on directory structure
  // check if newPath == path
  if (newPath === path) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "new path cannot be the same as old path.",
    });
    return;
  }

  // cannot move to it's own children
  if (newPath.startsWith("/" + fullPath)) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "new path cannot be on it's own children.",
    });
    return;
  }

  // check if has access to the old path + relativePath
  // get folder ID. check if folder exists, and user has access to it
  // get tree
  let { tree, err } = await getUsersTree(username);
  if (err !== undefined) {
    res.status(404).json({
      status: STATUS_ERROR,
      message: err,
    });
    return;
  }

  let { parentId: oldParentId, dataId, err: getParentIdAndDataIdFromTreeErr } = getParentIdAndDataIdFromTree(tree, path, relativePath);
  if (getParentIdAndDataIdFromTreeErr !== undefined) {
    res.status(404).json({
      status: STATUS_ERROR,
      message: getParentIdAndDataIdFromTreeErr,
    });
    return;
  }

  const { db } = getDB();
  const linkOrFolderRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(dataId);
  const linkOrFolderData = await linkOrFolderRef.get().then((doc: any) => doc.data());
  // validate: check if user can update the link. if user not the owner, publicAccess is not write, then return error
  if (req.headers.username !== username && linkOrFolderData.publicAccess !== "editor") {
    res.status(401).json({
      status: STATUS_ERROR,
      message: "Unauthorized.",
    });
    return;
  }

  // check if newPath + relativePath already exists
  let { parentId: newParentId, err: newPathRelativePathExistErr } = isRelativePathFreeInTree(tree, newPath, relativePath);
  if (newPathRelativePathExistErr !== undefined) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: newPathRelativePathExistErr,
    });
    return;
  }

  //   check if has access to the newPath
  const newParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(newParentId);
  const newParentData = await newParentRef.get().then((doc: any) => doc.data());

  // validate: check if user can update the link. if user not the owner, publicAccess is not write, then return error
  if (req.headers.username !== username && newParentData.publicAccess !== "editor") {
    res.status(401).json({
      status: STATUS_ERROR,
      message: "Unauthorized.",
    });
    return;
  }

  //   check if new parent data is folder
  if (newParentData.type !== "folder") {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "new path is not a folder.",
    });
    return;
  }

  //  validation done
  let dateUpdateHappen = new Date();

  // 4. update old parentData. remove the relativepath from children, and update metadata.
  const oldParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(oldParentId);
  const oldParentData = await oldParentRef.get().then((doc: any) => doc.data());

  delete oldParentData.children[relativePath];
  oldParentData.lastModified = dateUpdateHappen;
  oldParentData.lastModifiedBy = req.headers.username;
  if (linkOrFolderData.type === "folder") {
    oldParentData.folderCount -= 1;
  } else {
    oldParentData.linkCount -= 1;
  }

  //   update new parent. add the relativepath to children and update metadata
  let newChildrenData = { ...linkOrFolderData };
  delete newChildrenData.children;
  newParentData.children[relativePath] = newChildrenData;

  newParentData.lastModified = dateUpdateHappen;
  newParentData.lastModifiedBy = req.headers.username;
  if (linkOrFolderData.type === "folder") {
    newParentData.folderCount += 1;
  } else {
    newParentData.linkCount += 1;
  }

  //   hit firetore
  await oldParentRef.update(oldParentData);
  await newParentRef.update(newParentData);

  // 5. update grandparent. if root, skip this step
  //   update old grandParent
  let oldPathArray = path.split("/").filter((item: any) => item !== "");
  if (oldPathArray.length > 0) {
    let { lastDataId: oldGrandParentId, err } = getLastIdInPathFromTree(tree, oldPathArray.slice(0, oldPathArray.length - 1).join("/"));
    if (err !== undefined) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: err,
      });
      return;
    }

    const oldGrandParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(oldGrandParentId);
    let oldGrandParentData = await oldGrandParentRef.get();
    oldGrandParentData = oldGrandParentData.data();

    delete oldParentData.children;
    oldGrandParentData.children[oldPathArray[oldPathArray.length - 1]] = oldParentData;

    await oldGrandParentRef.set(oldGrandParentData);
  }

  //   update new grandParent
  let newPathArray = newPath.split("/").filter((item: any) => item !== "");
  if (newPathArray.length > 0) {
    let { lastDataId: newGrandParentId, err } = getLastIdInPathFromTree(tree, newPathArray.slice(0, newPathArray.length - 1).join("/"));
    if (err !== undefined) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: err,
      });
      return;
    }

    const newGrandParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(newGrandParentId);
    let newGrandParentData = await newGrandParentRef.get();
    newGrandParentData = newGrandParentData.data();

    delete newParentData.children;
    newGrandParentData.children[newPathArray[newPathArray.length - 1]] = newParentData;

    await newGrandParentRef.set(newGrandParentData);
  }
  //   6. update the tree
  let oldDataInTree = tree.root;
  for (let i = 0; i < oldPathArray.length; i++) {
    oldDataInTree = oldDataInTree.children[oldPathArray[i]];
  }

  let newDataInTree = tree.root;
  for (let i = 0; i < newPathArray.length; i++) {
    newDataInTree = newDataInTree.children[newPathArray[i]];
  }
  newDataInTree.children[relativePath] = oldDataInTree.children[relativePath];

  delete oldDataInTree.children[relativePath];
  await db.collection("linked-directories").doc(username).set({ tree });

  res.status(200).json({
    status: STATUS_SUCCESS,
  });
}
