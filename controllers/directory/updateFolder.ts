import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";
import { flattenDataInTree, getDB, getLastIdInPathFromTree, getParentIdAndDataIdFromTree, getUsersTree, isAnyUndefined, isRelativePathFreeInTree, validateBody } from "../../utils";
import { isAnyDefined } from "../../utils/isAnyDefined";

export async function updateFolder(req: VercelRequest, res: VercelResponse) {
  const { username, path, relativePath, title, isPinned, newRelativePath, newPath, publicAccess, personalAccess } = req.body;

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
  if (!isAnyDefined(isPinned, title, newRelativePath, newPath, publicAccess, personalAccess)) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body. At least one of the data must be provided. check docs for more info.",
    });
    return;
  }
  let errValidate = validateBody({ username, path, relativePath, title, isPinned, newRelativePath, newPath, publicAccess, personalAccess });
  if (errValidate !== undefined) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: errValidate,
    });
    return;
  }
  // validate body done

  // 2. get folder ID. check if folder exists, and user has access to it
  // get tree
  let { tree, err } = await getUsersTree(username);
  if (err !== undefined) {
    res.status(404).json({
      status: STATUS_ERROR,
      message: err,
    });
    return;
  }

  let { parentId, dataId: folderId, err: getParentIdAndDataIdFromTreeErr } = getParentIdAndDataIdFromTree(tree, path, relativePath);
  if (getParentIdAndDataIdFromTreeErr !== undefined) {
    res.status(404).json({
      status: STATUS_ERROR,
      message: getParentIdAndDataIdFromTreeErr,
    });
    return;
  }

  // get dataInTree for later use
  let dataInTree = tree.root;
  let pathArray = path.split("/").filter((item: any) => item !== "");
  for (let i = 0; i < pathArray.length; i++) {
    dataInTree = dataInTree.children[pathArray[i]];
  }
  dataInTree = dataInTree.children[relativePath];

  const { db } = getDB();
  const folderRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(folderId);
  const folderData = await folderRef.get().then((doc: any) => doc.data());
  // validate: check if user can update the link. if user not the owner, publicAccess is not write, and personalAccess to the user is not write, then return error
  if (req.headers.username !== username && folderData.publicAccess !== "editor" && !folderData.personalAccess.some((item: any) => item.username === req.headers.username && item.access === "editor")) {
    res.status(401).json({
      status: STATUS_ERROR,
      message: "Unauthorized.",
    });
    return;
  }
  // 3. four cases emerge from newRelativePath and newPath
  let allProperties: any = { isPinned, title, publicAccess, personalAccess };
  let updatedProperties: any = {};
  Object.keys(allProperties).forEach((key) => {
    if (allProperties[key] !== undefined) {
      updatedProperties[key] = allProperties[key];
    }
  });
  let newFolderData = { ...folderData, ...updatedProperties };

  let dateUpdateHappen = new Date();
  // update metadata
  newFolderData.lastModified = dateUpdateHappen;
  newFolderData.lastModifiedBy = req.headers.username;

  if (newRelativePath === undefined && newPath === undefined) {
    // 3.1 newRelativePath and newPath is undefined
    // a. update the parentData's children
    const case1ParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(parentId);
    const parentData = await case1ParentRef.get().then((doc: any) => doc.data());
    let newParentData = { ...parentData };

    newParentData.children[relativePath] = newFolderData;

    // b. update metadata
    newParentData.lastModified = dateUpdateHappen;
    newParentData.lastModifiedBy = req.headers.username;

    await case1ParentRef.set(newParentData);
  } else if (newRelativePath !== undefined && newPath === undefined) {
    // 3.2 newRelativePath is defined, newPath is undefined
    // a. validate: if newRelativePath is not taken
    let { parentId: case1ParentId, err } = isRelativePathFreeInTree(tree, path, newRelativePath);
    if (err !== undefined) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: err,
      });
      return;
    }
    // b. update the parentData's children
    const case2ParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(case1ParentId);
    const case2ParentData = await case2ParentRef.get().then((doc: any) => doc.data());
    let case2NewParentData = { ...case2ParentData };

    case2NewParentData.children[newRelativePath] = newFolderData;
    delete case2NewParentData.children[relativePath];

    // b.1 update metadata
    case2NewParentData.lastModified = dateUpdateHappen;
    case2NewParentData.lastModifiedBy = req.headers.username;

    await case2ParentRef.set(case2NewParentData);

    // c. update the tree
    let currentDataInTree = tree.root;
    let pathArray = path.split("/").filter((item: any) => item !== "");
    for (let i = 0; i < pathArray.length; i++) {
      currentDataInTree = currentDataInTree.children[pathArray[i]];
    }
    // c.1 add the new key
    currentDataInTree.children[newRelativePath] = {
      id: folderId,
      type: "folder",
      children: currentDataInTree.children[relativePath].children,
    };
    // c.2 delete the old key
    delete currentDataInTree.children[relativePath];

    await db.collection("linked-directories").doc(username).set({ tree });
  } else if (newRelativePath === undefined && newPath !== undefined) {
    // 3.3 newRelativePath is undefined, newPath is defined
    // a. validate: if newPath + relativePath is not taken
    let { parentId: case3ParentId, err } = isRelativePathFreeInTree(tree, newPath, relativePath);
    if (err !== undefined) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: err,
      });
      return;
    }
    // b. check if has access to the newpath
    const case3ParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(case3ParentId);
    const case3ParentData = await case3ParentRef.get().then((doc: any) => doc.data());
    // validate: check if user can update the link. if user not the owner, publicAccess is not write, and personalAccess to the user is not write, then return error
    if (req.headers.username !== username && case3ParentData.publicAccess !== "editor" && !case3ParentData.personalAccess.some((item: any) => item.username === req.headers.username && item.access === "editor")) {
      res.status(401).json({
        status: STATUS_ERROR,
        message: "Unauthorized.",
      });
      return;
    }

    // c. update the old and new parentData's children
    const case3OldParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(parentId);
    const case3OldParentData = await case3OldParentRef.get().then((doc: any) => doc.data());
    let case3NewParentData = { ...case3ParentData };

    case3NewParentData.children[relativePath] = newFolderData;
    delete case3OldParentData.children[relativePath];

    // d. update metadata
    // d.1 update old parent
    case3OldParentData.lastModified = dateUpdateHappen;
    case3OldParentData.lastModifiedBy = req.headers.username;
    case3OldParentData.folderCount -= 1;
    await case3OldParentRef.set(case3OldParentData);
    // d.2 update new parent
    case3NewParentData.lastModified = dateUpdateHappen;
    case3NewParentData.lastModifiedBy = req.headers.username;
    case3NewParentData.folderCount += 1;
    await case3ParentRef.set(case3NewParentData);

    // d.3 update the metadata in parent of old parent. if the parent is root, skip this step
    let pathArray = path.split("/").filter((item: any) => item !== "");
    if (pathArray.length > 0) {
      let { lastDataId: grandParentId, err } = getLastIdInPathFromTree(tree, pathArray.slice(0, pathArray.length - 1).join("/"));
      if (err !== undefined) {
        res.status(400).json({
          status: STATUS_ERROR,
          message: err,
        });
        return;
      }

      const grandParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(grandParentId);
      let newGrandParentData = await grandParentRef.get();
      newGrandParentData = newGrandParentData.data();

      delete case3OldParentData.children;
      newGrandParentData.children[pathArray[pathArray.length - 1]] = case3OldParentData;

      await grandParentRef.update(newGrandParentData);
    }

    // d.4 update the metadata in parent of new parent. if the parent is root, skip this step
    let newPathArray = newPath.split("/").filter((item: any) => item !== "");
    if (newPathArray.length > 0) {
      let { lastDataId: grandParentId, err } = getLastIdInPathFromTree(tree, newPathArray.slice(0, newPathArray.length - 1).join("/"));
      if (err !== undefined) {
        res.status(400).json({
          status: STATUS_ERROR,
          message: err,
        });
        return;
      }

      const grandParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(grandParentId);
      let newGrandParentData = await grandParentRef.get();
      newGrandParentData = newGrandParentData.data();

      delete case3NewParentData.children;
      newGrandParentData.children[newPathArray[newPathArray.length - 1]] = case3NewParentData;

      await grandParentRef.update(newGrandParentData);
    }

    // e. update the tree
    let case3OldDataInTree = tree.root;
    let case3PathArray = path.split("/").filter((item: any) => item !== "");
    for (let i = 0; i < case3PathArray.length; i++) {
      case3OldDataInTree = case3OldDataInTree.children[case3PathArray[i]];
    }

    let case3CurrentDataInTree = tree.root;
    let case3NewPathArray = newPath.split("/").filter((item: any) => item !== "");
    for (let i = 0; i < case3NewPathArray.length; i++) {
      case3CurrentDataInTree = case3CurrentDataInTree.children[case3NewPathArray[i]];
    }
    // e.1 add the new key in tree
    case3CurrentDataInTree.children[relativePath] = {
      id: folderId,
      type: "folder",
      children: case3OldDataInTree.children[relativePath].children,
    };
    // e.2 delete the old key in tree
    delete case3OldDataInTree.children[relativePath];
    await db.collection("linked-directories").doc(username).set({ tree });
  } else {
    // newRelativePath !== undefined && newPath !== undefined
    // 3.4 newRelativePath and newPath is defined
    // a. validate if newPath + newRelativePath is not taken
    let { parentId: case4ParentId, err } = isRelativePathFreeInTree(tree, newPath, newRelativePath);
    if (err !== undefined) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: err,
      });
      return;
    }
    // b. check if has access to the newpath
    const case4ParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(case4ParentId);
    const case4ParentData = await case4ParentRef.get().then((doc: any) => doc.data());
    // validate: check if user can update the link. if user not the owner, publicAccess is not write, and personalAccess to the user is not write, then return error
    if (req.headers.username !== username && case4ParentData.publicAccess !== "editor" && !case4ParentData.personalAccess.some((item: any) => item.username === req.headers.username && item.access === "editor")) {
      res.status(401).json({
        status: STATUS_ERROR,
        message: "Unauthorized.",
      });
      return;
    }

    // c. update the old and new parentData's children
    const case4OldParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(parentId);
    const case4OldParentData = await case4OldParentRef.get().then((doc: any) => doc.data());
    let case4NewParentData = { ...case4ParentData };

    case4NewParentData.children[newRelativePath] = newFolderData;
    delete case4OldParentData.children[relativePath];

    await case4OldParentRef.set(case4OldParentData);
    await case4ParentRef.set(case4NewParentData);

    // d. update metadata
    // d.1 update old parent
    case4OldParentData.lastModified = dateUpdateHappen;
    case4OldParentData.lastModifiedBy = req.headers.username;
    case4OldParentData.folderCount -= 1;
    await case4OldParentRef.set(case4OldParentData);
    // d.2 update new parent
    case4NewParentData.lastModified = dateUpdateHappen;
    case4NewParentData.lastModifiedBy = req.headers.username;
    case4NewParentData.folderCount += 1;
    await case4ParentRef.set(case4NewParentData);
    // d.3 update the metadata in parent of old parent. if the parent is root, skip this step
    let pathArray = path.split("/").filter((item: any) => item !== "");
    if (pathArray.length > 0) {
      let { lastDataId: grandParentId, err } = getLastIdInPathFromTree(tree, pathArray.slice(0, pathArray.length - 1).join("/"));
      if (err !== undefined) {
        res.status(400).json({
          status: STATUS_ERROR,
          message: err,
        });
        return;
      }

      const grandParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(grandParentId);
      let newGrandParentData = await grandParentRef.get();
      newGrandParentData = newGrandParentData.data();

      delete case4OldParentData.children;
      newGrandParentData.children[pathArray[pathArray.length - 1]] = case4OldParentData;

      await grandParentRef.update(newGrandParentData);
    }

    // d.4 update the metadata in parent of new parent. if the parent is root, skip this step
    let newPathArray = newPath.split("/").filter((item: any) => item !== "");
    if (newPathArray.length > 0) {
      let { lastDataId: grandParentId, err } = getLastIdInPathFromTree(tree, newPathArray.slice(0, newPathArray.length - 1).join("/"));
      if (err !== undefined) {
        res.status(400).json({
          status: STATUS_ERROR,
          message: err,
        });
        return;
      }

      const grandParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(grandParentId);
      let newGrandParentData = await grandParentRef.get();
      newGrandParentData = newGrandParentData.data();

      delete case4NewParentData.children;

      newGrandParentData.children[newPathArray[newPathArray.length - 1]] = case4NewParentData;

      await grandParentRef.update(newGrandParentData);
    }

    // e. update the tree
    let case4OldDataInTree = tree.root;
    let case4PathArray = path.split("/").filter((item: any) => item !== "");
    for (let i = 0; i < case4PathArray.length; i++) {
      case4OldDataInTree = case4OldDataInTree.children[case4PathArray[i]];
    }
    let case4CurrentDataInTree = tree.root;
    let case4NewPathArray = newPath.split("/").filter((item: any) => item !== "");
    for (let i = 0; i < case4NewPathArray.length; i++) {
      case4CurrentDataInTree = case4CurrentDataInTree.children[case4NewPathArray[i]];
    }
    // e.1 add the new key in tree
    case4CurrentDataInTree.children[newRelativePath] = {
      id: folderId,
      type: "folder",
      children: case4CurrentDataInTree.children[newRelativePath].children,
    };
    // e.2 delete the old key in tree
    delete case4OldDataInTree.children[relativePath];

    await db.collection("linked-directories").doc(username).set({ tree });
  }
  // 4. update all the children permission

  let isPublicAccessChanged = "publicAccess" in updatedProperties;
  let isPersonalAccessChanged = "personalAccess" in updatedProperties;
  console.log("isPublicAccessChanged, isPersonalAccessChanged");
  console.log(isPublicAccessChanged, isPersonalAccessChanged);
  if (isPublicAccessChanged || isPersonalAccessChanged) {
    console.log("permission changed");
    let { allIds, folderIds } = flattenDataInTree(dataInTree);
    let batch = db.batch();
    // 4.a update children's doc
    let newPermissions: any = {};
    if (isPublicAccessChanged) {
      newPermissions["publicAccess"] = updatedProperties["publicAccess"];
    }
    if (isPersonalAccessChanged) {
      newPermissions["personalAccess"] = updatedProperties["personalAccess"];
    }
    for (let i = 0; i < allIds.length; i++) {
      let updatedChildrenKey = { ...newPermissions };
      updatedChildrenKey["lastModified"] = dateUpdateHappen;
      updatedChildrenKey["lastModifiedBy"] = req.headers.username;
      const id = allIds[i];
      console.log("updatedChildrenKey");
      console.log(updatedChildrenKey);
      // for all folder, update the children's permission
      if (folderIds.includes(id)) {
        // take the children, then update the permission with the new one for each key in children
        let children = await db.collection("linked-directories").doc(username).collection("links-and-folders").doc(id).get();
        children = children.data();
        let newChildren = { ...children };
        let childrenRelativePath = Object.keys(children.children);
        for (let i = 0; i < childrenRelativePath.length; i++) {
          const childRelativePath = childrenRelativePath[i];
          newChildren.children[childRelativePath] = {
            ...newChildren.children[childRelativePath],
            ...newPermissions,
          };

          // lastModified and lastModifiedBy
          newChildren.children[childRelativePath]["lastModified"] = dateUpdateHappen;
          newChildren.children[childRelativePath]["lastModifiedBy"] = req.headers.username;
        }
        updatedChildrenKey["children"] = newChildren.children;
      }
      batch.update(db.collection("linked-directories").doc(username).collection("links-and-folders").doc(id), updatedChildrenKey);
    }
    await batch.commit();
    // 4.b update new folder data's children permission
    let childrenRelativePath = Object.keys(newFolderData.children);
    for (let i = 0; i < childrenRelativePath.length; i++) {
      const childRelativePath = childrenRelativePath[i];
      if (isPublicAccessChanged) {
        newFolderData.children[childRelativePath]["publicAccess"] = updatedProperties["publicAccess"];
      }
      if (isPersonalAccessChanged) {
        newFolderData.children[childRelativePath]["personalAccess"] = updatedProperties["personalAccess"];
      }
      // lastModified and lastModifiedBy
      newFolderData.children[childRelativePath]["lastModified"] = dateUpdateHappen;
      newFolderData.children[childRelativePath]["lastModifiedBy"] = req.headers.username;
    }
  }

  // 5. update the link itself
  await db.collection("linked-directories").doc(username).collection("links-and-folders").doc(folderId).set(newFolderData);

  res.status(200).json({
    status: STATUS_SUCCESS,
  });
}
