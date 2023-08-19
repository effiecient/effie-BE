import type { VercelRequest, VercelResponse } from "@vercel/node";
import { flattenDataInTree, getDB, getLastIdInPathFromTree, getParentIdAndDataIdFromTree, getUsersTree, isAnyUndefined, isRelativePathFreeInTree, validateBody } from "../../utils";
import { isAnyDefined } from "../../utils/isAnyDefined";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";

export async function updateLinkOrFolder(req: any, res: VercelResponse) {
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
  const { title, isPinned, publicAccess, newRelativePath } = req.body;
  // validate: check if at least one of the data is provided
  if (!isAnyDefined(isPinned, title, newRelativePath, publicAccess)) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body. At least one of the data must be provided. check docs for more info.",
    });
    return;
  }
  let errValidate = await validateBody({ username, path, title, isPinned, newRelativePath, publicAccess });
  if (errValidate !== undefined) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: errValidate,
    });
    return;
  }
  // validate body done

  // 3. get folder ID. check if folder exists, and user has access to it
  // get tree
  let { tree, err } = await getUsersTree(username);
  if (err !== undefined) {
    res.status(404).json({
      status: STATUS_ERROR,
      message: err,
    });
    return;
  }

  let { parentId, dataId, err: getParentIdAndDataIdFromTreeErr } = getParentIdAndDataIdFromTree(tree, path, relativePath);
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

  //   all valid. update the data
  //   1. setting up up new folder or link data
  let allProperties: any = { isPinned, title, publicAccess };
  let updatedProperties: any = {};
  Object.keys(allProperties).forEach((key) => {
    if (allProperties[key] !== undefined) {
      updatedProperties[key] = allProperties[key];
    }
  });
  let newLinkOrFolderData = { ...linkOrFolderData, ...updatedProperties };

  let dateUpdateHappen = new Date();
  // update metadata
  newLinkOrFolderData.lastModified = dateUpdateHappen;
  newLinkOrFolderData.lastModifiedBy = req.headers.username;

  // validate newRelativePath
  if (newRelativePath !== undefined) {
    // a. validate: if newRelativePath is not taken
    let { err } = isRelativePathFreeInTree(tree, path, newRelativePath);
    if (err !== undefined) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: err,
      });
      return;
    }

    // update the tree
    let currentParentInTree = tree.root;
    let pathArray = path.split("/").filter((item: any) => item !== "");
    for (let i = 0; i < pathArray.length; i++) {
      currentParentInTree = currentParentInTree.children[pathArray[i]];
    }
    const currentDataInTree = currentParentInTree.children[relativePath];
    // c.1 add the new key

    let newDataInTree: any = {
      id: dataId,
      type: currentDataInTree.type,
    };
    // if folder, add children
    if (currentDataInTree.children !== undefined) {
      newDataInTree["children"] = currentDataInTree.children;
    }

    currentParentInTree.children[newRelativePath] = newDataInTree;
    // c.2 delete the old key
    delete currentParentInTree.children[relativePath];

    await db.collection("linked-directories").doc(username).set({ tree });
  }

  // 2. setting up new parent data. update the parentData's children
  const parentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(parentId);
  const parentData = await parentRef.get().then((doc: any) => doc.data());
  let newParentData = { ...parentData };

  // remove .children if exists
  let temporaryNewLinkOrFolderData = { ...newLinkOrFolderData };
  if (temporaryNewLinkOrFolderData.children !== undefined) delete temporaryNewLinkOrFolderData.children;

  if (newRelativePath !== undefined) {
    // remove the old data
    delete newParentData.children[relativePath];
    // add the new data
    newParentData.children[newRelativePath] = temporaryNewLinkOrFolderData;
  } else {
    newParentData.children[relativePath] = temporaryNewLinkOrFolderData;
  }
  // update metadata
  newParentData.lastModified = dateUpdateHappen;
  newParentData.lastModifiedBy = req.headers.username;

  // 4. update all the children permission if folder
  let dataInTree = tree.root;
  for (let i = 0; i < pathArray.length - 1; i++) {
    dataInTree = dataInTree.children[pathArray[i]];
  }

  if (newRelativePath !== undefined) {
    dataInTree = dataInTree.children[newRelativePath];
  } else {
    dataInTree = dataInTree.children[relativePath];
  }

  let isPublicAccessChanged = "publicAccess" in updatedProperties;
  if (isPublicAccessChanged) {
    let { allIds, folderIds } = flattenDataInTree(dataInTree);
    let batch = db.batch();
    // 4.a update children's doc
    let newPermissions: any = {};
    if (isPublicAccessChanged) {
      newPermissions["publicAccess"] = updatedProperties["publicAccess"];
    }

    for (let i = 0; i < allIds.length; i++) {
      let updatedChildrenKey = { ...newPermissions };
      updatedChildrenKey["lastModified"] = dateUpdateHappen;
      updatedChildrenKey["lastModifiedBy"] = req.headers.username;

      const isFolder = folderIds.includes(allIds[i]);

      if (isFolder) {
        let data = await db
          .collection("linked-directories")
          .doc(username)
          .collection("links-and-folders")
          .doc(allIds[i])
          .get()
          .then((doc: any) => doc.data());
        const newChildren = { ...data.children };
        // update the children's permission
        // iterate through all the data.children key
        for (let key in newChildren) {
          // update the children's permission
          newChildren[key] = { ...newChildren[key], ...updatedChildrenKey };
        }
        updatedChildrenKey["children"] = newChildren;
      }
      batch.update(db.collection("linked-directories").doc(username).collection("links-and-folders").doc(allIds[i]), updatedChildrenKey);
    }
    await batch.commit();

    // update the folder's children, if folder
    if (newLinkOrFolderData.children !== undefined) {
      let updatedChildrenKey = { ...newPermissions };
      updatedChildrenKey["lastModified"] = dateUpdateHappen;
      updatedChildrenKey["lastModifiedBy"] = req.headers.username;
      for (let key in newLinkOrFolderData.children) {
        // update the children's permission
        newLinkOrFolderData.children[key] = { ...newLinkOrFolderData.children[key], ...updatedChildrenKey };
      }
    }
  }

  //   hit firestore
  await db.collection("linked-directories").doc(username).collection("links-and-folders").doc(dataId).set(newLinkOrFolderData);

  await parentRef.set(newParentData);

  res.status(200).json({
    status: STATUS_SUCCESS,
  });
}
