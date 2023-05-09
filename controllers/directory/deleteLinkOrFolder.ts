import { VercelRequest, VercelResponse } from "@vercel/node";
import { flattenDataInTree, getDB, getUsersTree } from "../../utils";
import { STATUS_ERROR, STATUS_SUCCESS } from "../../config";

export async function deleteLinkOrFolder(req: any, res: VercelResponse) {
  // can handle unknown path. so /api/directory/username/unknown/path can be handled, /api/directory/username/unknown/path/another/unknown/path can also be handled
  const { username } = req.params;

  // read /api/directory/username/* path, remove empty strings
  let pathArray = req.params["0"].split("/").filter((path: any) => path !== "");

  //validate: check if user is logged in
  if (!req.headers.username) {
    res.status(401).json({ status: STATUS_ERROR, message: "User not logged in." });
    return;
  }

  // validate: only allow owner to delete
  if (req.headers.username !== username) {
    res.status(401).json({ status: STATUS_ERROR, message: "Unauthorized. only owner can delete." });
    return;
  }
  // validate done

  // validate: check if path valid
  let { tree, err: treeErr } = await getUsersTree(username);
  if (treeErr) {
    res.status(400).json({ status: STATUS_ERROR, message: treeErr });
    return;
  }
  if (pathArray.length === 0) {
    res.status(400).json({ status: STATUS_ERROR, message: "Cannot delete root folder." });
    return;
  }

  let parentDataInTree = tree.root;
  let grandParentDataInTree: any = undefined;
  for (let i = 0; i < pathArray.length - 1; i++) {
    const folderName = pathArray[i];
    let temporaryPath = "";
    for (let j = 0; j <= i; j++) {
      temporaryPath += "/" + pathArray[j];
    }

    if (parentDataInTree === undefined) {
      res.status(404).json({ status: STATUS_ERROR, message: `${temporaryPath} does not exist` });
      return;
    }

    if (parentDataInTree.children === undefined) {
      res.status(404).json({ status: STATUS_ERROR, message: `${temporaryPath} is not a folder` });
      return;
    }

    if (i === pathArray.length - 2) {
      grandParentDataInTree = parentDataInTree;
    }

    if (folderName in parentDataInTree.children) {
      parentDataInTree = parentDataInTree.children[folderName];
    } else {
      res.status(404).json({ status: STATUS_ERROR, message: `${temporaryPath} does not exist` });

      return;
    }
  }

  let dataInTree = parentDataInTree.children[pathArray[pathArray.length - 1]];
  if (dataInTree === undefined) {
    res.status(404).json({ status: STATUS_ERROR, message: `${req.params["0"]} does not exist` });
    return;
  }
  let { allIds } = flattenDataInTree(dataInTree);

  const { db } = getDB();
  let batch = db.batch();
  for (let i = 0; i < allIds.length; i++) {
    const id = allIds[i];
    batch.delete(db.collection("linked-directories").doc(username).collection("links-and-folders").doc(id));
  }
  let type = parentDataInTree.children[pathArray[pathArray.length - 1]].type;

  // delete from tree
  delete parentDataInTree.children[pathArray[pathArray.length - 1]];

  await db.collection("linked-directories").doc(username).set({ tree });

  // delete from database
  await batch.commit();
  // update parent
  let parentData = await db.collection("linked-directories").doc(username).collection("links-and-folders").doc(parentDataInTree.id).get();
  parentData = parentData.data();
  let newParentData = { ...parentData };
  delete parentData.children[pathArray[pathArray.length - 1]];
  newParentData.children = parentData.children;
  if (type === "folder") {
    newParentData.folderCount -= 1;
  } else if (type === "link") {
    newParentData.linkCount -= 1;
  }

  let dateDeleteHappen = new Date();
  // updating metadata
  newParentData.lastModified = dateDeleteHappen;
  newParentData.lastModifiedBy = username;

  await db.collection("linked-directories").doc(username).collection("links-and-folders").doc(parentDataInTree.id).set(newParentData);

  // update grandparent
  if (grandParentDataInTree !== undefined) {
    let grandParentData = await db.collection("linked-directories").doc(username).collection("links-and-folders").doc(grandParentDataInTree.id).get();
    grandParentData = grandParentData.data();
    let newGrandParentData = { ...grandParentData };

    delete newParentData.children;
    newGrandParentData.children[pathArray[pathArray.length - 2]] = newParentData;
  }

  res.status(200).json({ status: STATUS_SUCCESS });
}
