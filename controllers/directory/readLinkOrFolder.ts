import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";
import { getDB } from "../../utils";

// can handle unknown path. so /api/directory/username/unknown/path can be handled, /api/directory/username/unknown/path/another/unknown/path can also be handled
export async function readLinkOrFolder(req: any, res: VercelResponse) {
  // 1. parse the input. input: username, path
  // read params
  const { username } = req.params;

  // read /api/directory/username/* path, remove empty strings
  let pathArray = req.params["0"].split("/").filter((path: any) => path !== "");

  const path = "/" + pathArray.join("/");

  // 2. get the link or folder id
  const { db } = getDB();

  // get rootRef
  const rootRef = db.collection("linked-directories").doc(username);

  // validate: check if username exists
  const root = await rootRef.get();
  if (!root.exists) {
    res.status(404).json({ status: STATUS_ERROR, message: "User not found.", path });
    return;
  }
  // get the tree
  const tree = root.data().tree;

  // traverse the tree, get the link or folder id
  let linkOrFolderId: any = tree;
  for (let i = 0; i < pathArray.length; i++) {
    if (linkOrFolderId[pathArray[i]]) {
      linkOrFolderId = linkOrFolderId[pathArray[i]];
    } else {
      res.status(404).json({ status: STATUS_ERROR, message: "File not found.", path });
      return;
    }
  }

  // 3. get the link or folder data
  // get the link or folder ref
  const linkOrFolderRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(linkOrFolderId);

  // get the link or folder data
  const linkOrFolderData = await linkOrFolderRef.get();
  if (!linkOrFolderData.exists) {
    res.status(404).json({ status: STATUS_ERROR, message: "File not found.", path });
    return;
  }

  // validate: handle if not accessed by owner and private
  // if (req.headers.username !== username && !linkOrFolderData.data().shareConfiguration?.isShared) {
  //   res.status(404).json({ status: STATUS_ERROR, message: "File not found.", path });

  // // at this point, the important variable is linkOrFolderData

  // // validate: handle if not accessed by owner and private
  // if (req.headers.username !== username && !linkOrFolderData.shareConfiguration?.isShared) {
  //   res.status(404).json({ status: STATUS_ERROR, message: "File not found.", path });
  //   return;
  // }

  // // setup return, add shareConfiguration if none exist
  // if (linkOrFolderData.shareConfiguration?.isShared === undefined) {
  //   linkOrFolderData.shareConfiguration = {};
  //   linkOrFolderData.shareConfiguration.isShared = false;
  // } else {
  //   // if shared but without sharedPrivilege, add read
  //   if (linkOrFolderData.shareConfiguration.sharedPrivilege === undefined) {
  //     linkOrFolderData.shareConfiguration.sharedPrivilege = "read";
  //   }
  // }
  // if (linkOrFolderData.type === "folder") {
  //   if (linkOrFolderData.childrens) {
  //     // iterate through childrens object, add shareConfiguration if none exist
  //     Object.keys(linkOrFolderData.childrens).forEach((child: any) => {
  //       if (linkOrFolderData.childrens[child].shareConfiguration?.isShared === undefined) {
  //         linkOrFolderData.childrens[child].shareConfiguration = {};
  //         linkOrFolderData.childrens[child].shareConfiguration.isShared = false;
  //       } else {
  //         // if shared but without sharedPrivilege, add read
  //         if (linkOrFolderData.childrens[child].shareConfiguration.sharedPrivilege === undefined) {
  //           linkOrFolderData.childrens[child].shareConfiguration.sharedPrivilege = "read";
  //         }
  //       }
  //     });
  //   }
  // }
  // // hide private data
  // if (req.headers.username !== username) {
  //   // if type is folder, check if childrens is shared. if not, remove childrens
  //   if (linkOrFolderData.type === "folder") {
  //     if (linkOrFolderData.childrens) {
  //       Object.keys(linkOrFolderData.childrens).forEach((child: any) => {
  //         if (!linkOrFolderData.childrens[child].shareConfiguration.isShared) {
  //           delete linkOrFolderData.childrens[child];
  //         }
  //       });
  //     }
  //   }
  // }
  // // return
  res.json({ status: STATUS_SUCCESS, path, data: linkOrFolderData });
}
