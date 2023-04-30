import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";
import { isAnyDefined, getDB, getLastIdInPathFromTree, getParentIdAndDataIdFromTree, getUsersTree, isAnyUndefined, isRelativePathFreeInTree, isRelativePathValid, validateBody } from "../../utils";

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
  let errValidate = validateBody({ username, path, relativePath, link, title, isPinned, newRelativePath, newPath, publicAccess, personalAccess });
  if (errValidate !== undefined) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: errValidate,
    });
    return;
  }
  // validate body done

  // 2. get link ID. check if link exists, and user has access to it
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

  const { db } = getDB();
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

  // update metadata
  newLinkData.lastModified = new Date();
  newLinkData.lastModifiedBy = req.headers.username;

  if (newRelativePath === undefined && newPath === undefined) {
    // 3.1 newRelativePath and newPath is undefined
    // a. update the parentData's children
    const case1ParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(parentId);
    const parentData = await case1ParentRef.get().then((doc: any) => doc.data());
    let newParentData = { ...parentData };

    newParentData.children[relativePath] = newLinkData;

    // b. update metadata
    newParentData.lastModified = new Date();
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
    const case2ParentRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(parentId);
    const case2ParentData = await case2ParentRef.get().then((doc: any) => doc.data());
    let case2NewParentData = { ...case2ParentData };

    case2NewParentData.children[newRelativePath] = newLinkData;
    delete case2NewParentData.children[relativePath];

    // b.1 update metadata
    case2NewParentData.lastModified = new Date();
    case2NewParentData.lastModifiedBy = req.headers.username;

    await case2ParentRef.set(case2NewParentData);

    // c. update the tree
    // c.1 delete the old key
    let currentDataInTree = tree.root;
    let pathArray = path.split("/").filter((item: any) => item !== "");
    for (let i = 0; i < pathArray.length; i++) {
      currentDataInTree = currentDataInTree.children[pathArray[i]];
    }
    delete currentDataInTree.children[relativePath];
    // c.2 add the new key
    currentDataInTree.children[newRelativePath] = {
      id: linkId,
      type: "link",
    };

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
    if (req.headers.username !== username && case3ParentData.publicAccess !== "write" && !case3ParentData.personalAccess.some((item: any) => item.username === req.headers.username && item.access === "write")) {
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

    case3NewParentData.children[relativePath] = newLinkData;
    delete case3OldParentData.children[relativePath];

    // d. update metadata
    // d.1 update old parent
    case3OldParentData.lastModified = new Date();
    case3OldParentData.lastModifiedBy = req.headers.username;
    case3OldParentData.linkCount -= 1;
    await case3OldParentRef.set(case3OldParentData);
    // d.2 update new parent
    case3NewParentData.lastModified = new Date();
    case3NewParentData.lastModifiedBy = req.headers.username;
    case3NewParentData.linkCount += 1;
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
    // e.1 delete the old key in tree
    let case3OldDataInTree = tree.root;
    let case3PathArray = path.split("/").filter((item: any) => item !== "");
    for (let i = 0; i < case3PathArray.length; i++) {
      case3OldDataInTree = case3OldDataInTree.children[case3PathArray[i]];
    }
    delete case3OldDataInTree.children[relativePath];
    // e.2 add the new key in tree
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
    if (req.headers.username !== username && case4ParentData.publicAccess !== "write" && !case4ParentData.personalAccess.some((item: any) => item.username === req.headers.username && item.access === "write")) {
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

    case4NewParentData.children[newRelativePath] = newLinkData;
    delete case4OldParentData.children[relativePath];

    await case4OldParentRef.set(case4OldParentData);
    await case4ParentRef.set(case4NewParentData);

    // d. update metadata
    // d.1 update old parent
    case4OldParentData.lastModified = new Date();
    case4OldParentData.lastModifiedBy = req.headers.username;
    case4OldParentData.linkCount -= 1;
    await case4OldParentRef.set(case4OldParentData);
    // d.2 update new parent
    case4NewParentData.lastModified = new Date();
    case4NewParentData.lastModifiedBy = req.headers.username;
    case4NewParentData.linkCount += 1;
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
    // e.1 delete the old key in tree
    let case4OldDataInTree = tree.root;
    let case4PathArray = path.split("/").filter((item: any) => item !== "");
    for (let i = 0; i < case4PathArray.length; i++) {
      case4OldDataInTree = case4OldDataInTree.children[case4PathArray[i]];
    }
    delete case4OldDataInTree.children[relativePath];
    // e.2 add the new key in tree
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
