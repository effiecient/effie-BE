import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";
import { getDB, getLastIdInPathFromTree, isAnyUndefined, validateBody } from "../../utils";

export async function createLink(req: VercelRequest, res: VercelResponse) {
  // 1. PARSE INPUT: Authenctation and body
  // validate: must be logged in to create link
  if (req.headers.username === undefined) {
    res.status(401).json({
      status: STATUS_ERROR,
      message: "Unauthorized",
    });
    return;
  }
  // validate: parse the body
  let { username, link, path, relativePath, title, isPinned, publicAccess, personalAccess } = req.body;
  if (isAnyUndefined(username, link, path, relativePath)) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body. please refer to the documentation for the correct format.",
    });
    return;
  }

  let errValidate = validateBody({ username, link, path, relativePath, title, isPinned, publicAccess, personalAccess });
  if (errValidate !== undefined) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: errValidate,
    });
    return;
  }

  //2. check if the parent folder exists
  const { db } = getDB();

  let tree;
  const userDirectoryRef = db.collection("linked-directories").doc(username);
  const userDirectoryData = await userDirectoryRef.get();
  if (!userDirectoryData.exists) {
    // error: user doesn't exist
    res.status(404).json({
      status: STATUS_ERROR,
      message: "User does not exist",
    });
    return;
  } else {
    tree = userDirectoryData.data().tree;
  }
  //   get the parent of the link ref
  // turn path from "/" or "/testing"or "/testing/another" ["testing", "another"]
  const pathArray = path.split("/").filter((item: any) => item !== "");

  // validate: check if the parent exists
  let parentDataInTree = tree.root;
  for (let i = 0; i < pathArray.length; i++) {
    const folderName = pathArray[i];
    let temporaryPath = "";
    for (let j = 0; j <= i; j++) {
      temporaryPath += "/" + pathArray[j];
    }
    if (parentDataInTree.children === undefined) {
      res.status(404).json({
        status: STATUS_ERROR,
        message: `${path} does not exist`,
      });
      return;
    }

    if (folderName in parentDataInTree.children) {
      parentDataInTree = parentDataInTree.children[folderName];
    } else {
      res.status(404).json({
        status: STATUS_ERROR,
        message: `${temporaryPath} does not exist`,
      });
      return;
    }
  }
  // validate: check if parentDataInTree.type === "folder"
  if (parentDataInTree.type !== "folder") {
    res.status(400).json({
      status: STATUS_ERROR,
      message: `${path} is not a folder`,
    });
    return;
  }

  let parentId = parentDataInTree.id;

  // 3. check if has permission to create link in the parent folder
  const parentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(parentId);
  let newParentData = await parentRef.get();
  newParentData = newParentData.data();
  // validate: check if the user has permission to create link in the parent folder. if not the owner, public access is not write,the user is not in the personal access list with write access, return 403
  // personal access is an array of objects {username: string, access: string}
  if (req.headers.username !== username && newParentData.publicAccess !== "write" && !newParentData.personalAccess.some((item: any) => item.username === req.headers.username && item.access === "write")) {
    res.status(403).json({
      status: STATUS_ERROR,
      message: `You do not have permission to create link in ${path}`,
    });
    return;
  }

  // 4. validate: check if the link already exists
  if (relativePath in parentDataInTree.children) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: `${relativePath} already exists in ${path}`,
    });
    return;
  }
  // 5. create the document for the link with random id. if public and personal access is undefined, use the parent's public and personal access

  // handle default value
  title = title === undefined ? relativePath : title;
  isPinned = isPinned === undefined ? false : isPinned;
  publicAccess = publicAccess === undefined ? newParentData.publicAccess : publicAccess;
  personalAccess = personalAccess === undefined ? newParentData.personalAccess : personalAccess;

  const newLinkRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc();
  const newLinkId = newLinkRef.id;
  const newLinkData = {
    id: newLinkId,
    type: "link",
    title,
    link,
    isPinned,
    publicAccess,
    personalAccess,
    createdAt: new Date(),
    lastModified: new Date(),
    lastModifiedBy: req.headers.username,
  };
  await newLinkRef.set(newLinkData);

  // 6. update the parent document children array, lastModified, lastModifiedBy, linkCount
  newParentData.lastModified = newLinkData.lastModified;
  newParentData.lastModifiedBy = req.headers.username;
  newParentData.linkCount += 1;
  newParentData.children[relativePath] = newLinkData;

  await parentRef.update(newParentData);

  // 7. update the metadata in parent of parent. if the parent is root, skip this step
  if (pathArray.length > 0) {
    let { lastDataId: grandParentId, err } = getLastIdInPathFromTree(tree, pathArray.slice(0, pathArray.length - 1).join("/"));
    if (err) {
      res.status(404).json({
        status: STATUS_ERROR,
        message: `${path} does not exist`,
      });
      return;
    }
    const grandParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(grandParentId);
    let newGrandParentData = await grandParentRef.get();
    newGrandParentData = newGrandParentData.data();
    // delete children from newParentData
    delete newParentData.children;
    newGrandParentData.children[pathArray[pathArray.length - 1]] = newParentData;
    await grandParentRef.update(newGrandParentData);
  }

  // 8. update the tree in the path from root. add id and type to the tree
  let currentDataInTree = tree.root;
  for (let i = 0; i < pathArray.length; i++) {
    const folderName = pathArray[i];
    currentDataInTree = currentDataInTree.children[folderName];
  }
  currentDataInTree.children[relativePath] = {
    id: newLinkId,
    type: "link",
  };

  await userDirectoryRef.set({ tree });

  res.status(200).json({
    status: STATUS_SUCCESS,
  });
}
