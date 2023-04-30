import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";
import { getDB, isAnyUndefined, isRelativePathValid } from "../../utils";
import { isAnyDefined } from "../../utils/isAnyDefined";
import { isShareConfiguration } from "../../typeValidator";

export async function updateLink(req: VercelRequest, res: VercelResponse) {
  const { username, path, relativePath, link, title, isPinned, newRelativePath, newPath, publicAccess, personalAccess } = req.body;

  // 1. validate input: header and body
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
  if (!isAnyDefined(isPinned, title, newRelativePath, newPath, link, publicAccess, personalAccess)) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body. At least one of the data must be provided. check docs for more info.",
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
  // validate: check if newPath start with /
  if (newPath !== undefined) {
    if (newPath[0] !== "/") {
      res.status(400).json({
        status: STATUS_ERROR,
        message: "Invalid newPath.",
      });
      return;
    }
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
  // validate body done

  // 2. get link ID. check if link exists, and user has access to it
  const { db } = getDB();
  // get tree
  let { tree, err } = await getUsersTree(username);
  if (err !== undefined) {
    res.status(404).json({
      status: STATUS_ERROR,
      message: err,
    });
    return;
  }

  let { parentId, dataId: linkId, err: getParentIdAndDataIdFromTreeErr } = getParentIdAndDataIdFromTree(tree, path, relativePath);
  if (getParentIdAndDataIdFromTreeErr !== undefined) {
    res.status(404).json({
      status: STATUS_ERROR,
      message: getParentIdAndDataIdFromTreeErr,
    });
    return;
  }

  const linkRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(linkId);
  const linkData = await linkRef.get().then((doc: any) => doc.data());
  // validate: check if user can update the link. if user not the owner, publicAccess is not write, and personalAccess to the user is not write, then return error
  if (req.headers.username !== username && linkData.publicAccess !== "write" && !linkData.personalAccess.some((item: any) => item.username === req.headers.username && item.access === "write")) {
    res.status(401).json({
      status: STATUS_ERROR,
      message: "Unauthorized.",
    });
    return;
  }

  // 3. four cases emerge from newRelativePath and newPath
  let allProperties: any = { link, isPinned, title, publicAccess, personalAccess };
  let updatedProperties: any = {};
  Object.keys(allProperties).forEach((key) => {
    if (allProperties[key] !== undefined) {
      updatedProperties[key] = allProperties[key];
    }
  });
  let newLinkData = { ...linkData, ...updatedProperties };
  if (newRelativePath === undefined && newPath === undefined) {
    // 3.1 newRelativePath and newPath is undefined
    // a. update the parentData's children
    const case1ParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(parentId);
    const parentData = await case1ParentRef.get().then((doc: any) => doc.data());
    let newParentData = { ...parentData };
    // newParentData.children is an array of objects with the relativePath as the key.
    Object.keys(newParentData.children).forEach((key) => {
      if (newParentData.children[key] === relativePath) {
        newParentData.children[key] = newLinkData;
      }
    });
    await case1ParentRef.set(newParentData);
  } else if (newRelativePath !== undefined && newPath === undefined) {
    // 3.2 newRelativePath is defined, newPath is undefined
    // a. validate: if newRelativePath is not taken
    let { parentId: case2ParentId, dataId: newLinkId, err: case2Err } = getParentIdAndDataIdFromTree(tree, path, newRelativePath);
    // if newLinkId is not undefined, then it means that the newRelativePath is taken
    if (newLinkId !== undefined) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: "newRelativePath is taken.",
      });
      return;
    }
    // a. update the parentData's children
    const case2ParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(parentId);
    const case2ParentData = await case2ParentRef.get().then((doc: any) => doc.data());
    let case2NewParentData = { ...case2ParentData };
    Object.keys(case2NewParentData.children).forEach((key) => {
      if (case2NewParentData.children[key] === newRelativePath) {
        case2NewParentData.children[key] = newLinkData;
      }
    });
    // delete the old key
    delete case2NewParentData.children[relativePath];
    await case2ParentRef.set(case2NewParentData);
    // b. update the tree
    let currentDataInTree = tree.root;
    let pathArray = path.split("/").filter((item: any) => item !== "");
    for (let i = 0; i < pathArray.length; i++) {
      currentDataInTree = currentDataInTree.children[pathArray[i]];
    }
    currentDataInTree.children[newRelativePath] = {
      id: linkId,
      type: "link",
    };
    // delete the old key
    delete currentDataInTree.children[relativePath];
    await db.collection("linked-directories").doc(username).set({ tree });
  } else if (newRelativePath === undefined && newPath !== undefined) {
    // 3.3 newRelativePath is undefined, newPath is defined
    // a. validate: if newPath + relativePath is not taken
    let { parentId: case3ParentId, dataId: case3NewLinkDataId, err: case3Err } = getParentIdAndDataIdFromTree(tree, newPath, relativePath);
    // if case3NewLinkDataId is not undefined, then it means that the newPath + relativePath is taken
    if (case3NewLinkDataId !== undefined) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: "newPath + relativePath is taken.",
      });
      return;
    }
    // a. update the old and new parentData's children
    const case3OldParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(parentId);
    const case3OldParentData = await case3OldParentRef.get().then((doc: any) => doc.data());
    const case3ParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(case3ParentId);
    const case3ParentData = await case3ParentRef.get().then((doc: any) => doc.data());
    let case3NewParentData = { ...case3ParentData };
    Object.keys(case3NewParentData.children).forEach((key) => {
      if (case3NewParentData.children[key] === relativePath) {
        case3NewParentData.children[key] = newLinkData;
      }
    });
    // delete the old key
    delete case3OldParentData.children[relativePath];
    await case3OldParentRef.set(case3OldParentData);
    await case3ParentRef.set(case3NewParentData);

    // b. update the tree
    let case3OldDataInTree = tree.root;
    let case3PathArray = path.split("/").filter((item: any) => item !== "");
    for (let i = 0; i < case3PathArray.length; i++) {
      case3OldDataInTree = case3OldDataInTree.children[case3PathArray[i]];
    }
    // delete the old key
    delete case3OldDataInTree.children[relativePath];

    let case3CurrentDataInTree = tree.root;
    let case3NewPathArray = newPath.split("/").filter((item: any) => item !== "");
    for (let i = 0; i < case3NewPathArray.length; i++) {
      case3CurrentDataInTree = case3CurrentDataInTree.children[case3NewPathArray[i]];
    }
    case3CurrentDataInTree.children[relativePath] = {
      id: linkId,
      type: "link",
    };
    await db.collection("linked-directories").doc(username).set({ tree });
  } else {
    //newRelativePath !== undefined && newPath !== undefined
    // 3.4 newRelativePath and newPath is defined
    // a. validate if newPath + newRelativePath is not taken
    let { parentId: case4ParentId, dataId: case4NewLinkDataId, err: case4Err } = getParentIdAndDataIdFromTree(tree, newPath, newRelativePath);
    // if case4NewLinkDataId is not undefined, then it means that the newPath + newRelativePath is taken
    if (case4NewLinkDataId !== undefined) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: "newPath + newRelativePath is taken.",
      });
      return;
    }
    // b. update the old and new parentData's children
    const case4OldParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(parentId);
    const case4OldParentData = await case4OldParentRef.get().then((doc: any) => doc.data());
    const case4ParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(case4ParentId);
    const case4ParentData = await case4ParentRef.get().then((doc: any) => doc.data());
    let case4NewParentData = { ...case4ParentData };
    Object.keys(case4NewParentData.children).forEach((key) => {
      if (case4NewParentData.children[key] === newRelativePath) {
        case4NewParentData.children[key] = newLinkData;
      }
    });

    // delete the old key
    delete case4OldParentData.children[relativePath];

    await case4OldParentRef.set(case4OldParentData);
    await case4ParentRef.set(case4NewParentData);

    // c. update the tree
    let case4OldDataInTree = tree.root;
    let case4PathArray = path.split("/").filter((item: any) => item !== "");
    for (let i = 0; i < case4PathArray.length; i++) {
      case4OldDataInTree = case4OldDataInTree.children[case4PathArray[i]];
    }
    // delete the old key
    delete case4OldDataInTree.children[relativePath];

    let case4CurrentDataInTree = tree.root;
    let case4NewPathArray = newPath.split("/").filter((item: any) => item !== "");
    for (let i = 0; i < case4NewPathArray.length; i++) {
      case4CurrentDataInTree = case4CurrentDataInTree.children[case4NewPathArray[i]];
    }
    case4CurrentDataInTree.children[newRelativePath] = {
      id: linkId,
      type: "link",
    };
    await db.collection("linked-directories").doc(username).set({ tree });
  }
  // 4. update the link itself
  await db.collection("linked-directories").doc(username).collection("links-and-folders").doc(linkId).set(newLinkData);
  res.status(200).json({
    status: STATUS_SUCCESS,
  });
}

async function getUsersTree(username: string) {
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

function getParentIdAndDataIdFromTree(tree: any, path: string, relativePath: string) {
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
      err = `${path} does not exist`;
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
