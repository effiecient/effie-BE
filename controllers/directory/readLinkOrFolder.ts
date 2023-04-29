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

  // 2. check if path exists
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

  // get the link or folder ref

  let linkOrFolderDataInTree = tree.root;
  for (let i = 0; i < pathArray.length; i++) {
    const folderName = pathArray[i];
    let temporaryPath = "";
    for (let j = 0; j <= i; j++) {
      temporaryPath += "/" + pathArray[j];
    }
    if (linkOrFolderDataInTree.children === undefined) {
      res.status(404).json({
        status: STATUS_ERROR,
        message: `${path} not available or you don't have permission to read`,
      });
      return;
    }

    if (folderName in linkOrFolderDataInTree.children) {
      linkOrFolderDataInTree = linkOrFolderDataInTree.children[folderName];
    } else {
      res.status(404).json({
        status: STATUS_ERROR,
        message: `${temporaryPath} not available or you don't have permission to read`,
      });
      return;
    }
  }

  // 3. check if has permission to read
  const linkOrFolderRef = db.collection("linked-directories").doc(username).collection("links-and-folders").doc(linkOrFolderDataInTree.id);
  let linkOrFolderData = await linkOrFolderRef.get();
  linkOrFolderData = linkOrFolderData.data();

  // validate: check if the user has permission to read. if not the owner, public access is not read or write, the user is not in the personal access list with read or write access, return 403
  // personal access is an array of objects {username: string, access: string}
  if (
    req.headers.username !== username &&
    linkOrFolderData.publicAccess !== "read" &&
    linkOrFolderData.publicAccess !== "write" &&
    !linkOrFolderData.personalAccess.some((item: any) => item.username === req.headers.username && (item.access === "read" || item.access === "write"))
  ) {
    res.status(404).json({
      status: STATUS_ERROR,
      message: `${path} not available or you don't have permission to read`,
    });
    return;
  }

  // 4. hide private data
  // if the user is not the owner and type is folder, hide children if public access is not read or write, and personal access to the user is not read or write
  if (req.headers.username !== username && linkOrFolderData.type === "folder") {
    linkOrFolderData.children = linkOrFolderData.children.filter((child: any) => {
      if (child.publicAccess === "read" || child.publicAccess === "write") {
        return true;
      } else if (child.personalAccess.some((item: any) => item.username === req.headers.username && (item.access === "read" || item.access === "write"))) {
        return true;
      } else {
        return false;
      }
    });
  }

  res.json({ status: STATUS_SUCCESS, path, data: linkOrFolderData });
}
