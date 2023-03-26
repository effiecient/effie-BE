import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";
import { getDB } from "../../utils";

export async function readLinkOrFolder(req: any, res: VercelResponse) {
  // can handle unknown path. so /api/directory/username/unknown/path can be handled, /api/directory/username/unknown/path/another/unknown/path can also be handled

  // parse the input and validate
  // read params
  const { username } = req.params;

  // read /api/directory/username/* path, remove empty strings
  let pathArray = req.params["0"].split("/").filter((path: any) => path !== "");

  const path = "/" + pathArray.join("/");

  // start getting data from firestore
  const { db } = getDB();

  // get rootRef
  const rootRef = db.collection("directories").doc(username);

  // check if username exists
  const root = await rootRef.get();
  if (!root.exists) {
    res.status(404).json({ status: STATUS_ERROR, message: "User not found.", path });
    return;
  }

  let parentRef = rootRef;
  // for each path in pathArray, update the parentRef until 1 from last
  pathArray.slice(0, pathArray.length - 1).forEach((relativePath: any) => {
    parentRef = parentRef.collection("childrens").doc(relativePath);
  });

  // validate: check if parentRef exists
  const parent = await parentRef.get();
  if (!parent.exists) {
    res.status(404).json({ status: STATUS_ERROR, message: "File not found.", path });
    return;
  }

  // get data
  let parentData = parent.data();
  // check the children of parentData and get the last path in pathArray
  if (!parentData.childrens) {
    res.status(404).json({ status: STATUS_ERROR, message: "File not found.", path });
    return;
  }
  const linkOrFolderAsChildren = parentData.childrens[pathArray[pathArray.length - 1]];

  // validate: check if linkOrFolderData exists
  if (!linkOrFolderAsChildren) {
    res.status(404).json({ status: STATUS_ERROR, message: "File not found.", path });
    return;
  }

  // if type is folder, get the folderRef
  let linkOrFolderData: any;
  if (linkOrFolderAsChildren.type === "folder") {
    let linkOrFolderRef = parentRef.collection("childrens").doc(pathArray[pathArray.length - 1]);
    const linkOrFolder = await linkOrFolderRef.get();
    if (!linkOrFolder.exists) {
      res.status(404).json({ status: STATUS_ERROR, message: "File not found.", path });
      return;
    }
    linkOrFolderData = linkOrFolder.data();
  } else {
    linkOrFolderData = linkOrFolderAsChildren;
  }

  // validate: handle if not accessed by owner and private
  if (req.headers.username !== username && !linkOrFolderData.shareConfiguration?.isShared) {
    res.status(404).json({ status: STATUS_ERROR, message: "File not found.", path });
    return;
  }

  // setup return, add shareConfiguration if none exist
  if (linkOrFolderData.shareConfiguration?.isShared === undefined) {
    linkOrFolderData.shareConfiguration = {};
    linkOrFolderData.shareConfiguration.isShared = false;
  }
  if (linkOrFolderData.type === "folder") {
    if (linkOrFolderData.childrens) {
      // iterate through childrens object, add shareConfiguration if none exist
      Object.keys(linkOrFolderData.childrens).forEach((child: any) => {
        if (linkOrFolderData.childrens[child].shareConfiguration?.isShared === undefined) {
          linkOrFolderData.childrens[child].shareConfiguration = {};
          linkOrFolderData.childrens[child].shareConfiguration.isShared = false;
        }
      });
    }
  }
  // hide private data
  if (req.headers.username !== username) {
    // if type is folder, check if childrens is shared. if not, remove childrens
    if (linkOrFolderData.type === "folder") {
      if (linkOrFolderData.childrens) {
        linkOrFolderData.childrens = linkOrFolderData.childrens.filter((child: any) => child.isShared);
      }
    }
  }
  // return
  res.json({ status: STATUS_SUCCESS, path, data: linkOrFolderData });
}
