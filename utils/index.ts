export { getUsernameById } from "./getUsernameById";
export { createTokenJWT, verifyTokenJWT } from "./jwt";
export { getDB, getFirebaseAuth } from "./firebase";
export { recursiveUpdateDocumentShareConfiguration } from "./recursiveUpdateDocumentShareConfiguration";
export { isRelativePathValid, validateBody } from "./validation";
export { recursiveCloneDocument } from "./recursiveCloneDocument";
export { recursiveDeleteDocument } from "./recursiveDeleteDocument";
export { isAnyUndefined } from "./isAnyUndefined";
export { isAnyDefined } from "./isAnyDefined";

import { getDB } from "./firebase";

export async function getUsersTree(username: string) {
  let err: any = undefined;
  let tree: any = undefined;

  const { db } = getDB();
  let userDirectoryRef = db.collection("linked-directories").doc(username);
  const userDirectoryData = await userDirectoryRef.get();
  if (!userDirectoryData.exists) {
    err = "User does not exist.";
  } else {
    tree = userDirectoryData.data().tree;
  }
  return { tree, err };
}

export function getParentIdAndDataIdFromTree(tree: any, path: string, relativePath: string) {
  let parentId: any = undefined;
  let dataId: any = undefined;
  let err: any = undefined;

  let pathArray = path.split("/").filter((item: any) => item !== "");

  let parentDataInTree = tree.root;
  for (let i = 0; i < pathArray.length; i++) {
    const folderName = pathArray[i];
    let temporaryPath = "";
    for (let j = 0; j <= i; j++) {
      temporaryPath += "/" + pathArray[j];
    }
    if (parentDataInTree.children === undefined) {
      err = `${temporaryPath} is not a folder`;
      break;
    }

    if (folderName in parentDataInTree.children) {
      parentDataInTree = parentDataInTree.children[folderName];
    } else {
      err = `${temporaryPath} does not exist`;
      break;
    }
  }
  parentId = parentDataInTree.id;
  if (relativePath in parentDataInTree.children) {
    dataId = parentDataInTree.children[relativePath].id;
  } else {
    err = `${relativePath} does not exist`;
  }

  return { parentId, dataId, err };
}

export function isRelativePathFreeInTree(tree: any, path: string, relativePath: string) {
  let parentId: any = undefined;
  let err: any = undefined;

  let pathArray = path.split("/").filter((item: any) => item !== "");

  let parentDataInTree = tree.root;
  for (let i = 0; i < pathArray.length; i++) {
    const folderName = pathArray[i];
    let temporaryPath = "";
    for (let j = 0; j <= i; j++) {
      temporaryPath += "/" + pathArray[j];
    }
    if (parentDataInTree.children === undefined) {
      err = `${temporaryPath} is not a folder`;
      break;
    }

    if (folderName in parentDataInTree.children) {
      parentDataInTree = parentDataInTree.children[folderName];
    } else {
      err = `${temporaryPath} does not exist`;
      break;
    }
  }
  if (relativePath in parentDataInTree.children) {
    err = `${relativePath} is taken`;
  }

  parentId = parentDataInTree.id;

  return { parentId, err };
}

export function getLastIdInPathFromTree(tree: any, path: string) {
  let lastDataId: any = undefined;
  let err: any = undefined;

  let pathArray = path.split("/").filter((item: any) => item !== "");

  let dataInTree = tree.root;
  for (let i = 0; i < pathArray.length; i++) {
    const folderName = pathArray[i];
    let temporaryPath = "";
    for (let j = 0; j <= i; j++) {
      temporaryPath += "/" + pathArray[j];
    }
    if (dataInTree.children === undefined) {
      err = `${temporaryPath} is not a folder`;
      break;
    }

    if (folderName in dataInTree.children) {
      dataInTree = dataInTree.children[folderName];
    } else {
      err = `${temporaryPath} does not exist`;
      break;
    }
  }
  lastDataId = dataInTree.id;

  return { lastDataId, err };
}
