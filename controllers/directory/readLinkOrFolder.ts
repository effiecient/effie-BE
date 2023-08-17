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
    linkOrFolderData.publicAccess !== "viewer" &&
    linkOrFolderData.publicAccess !== "editor" &&
    !linkOrFolderData.personalAccess.some((item: any) => item.username === req.headers.username && (item.access === "viewer" || item.access === "editor"))
  ) {
    res.status(404).json({
      status: STATUS_ERROR,
      message: `${path} not available or you don't have permission to read`,
    });
    return;
  }

  // 4. return children as array and add relativePath as key
  if (linkOrFolderData.children) {
    linkOrFolderData.children = Object.keys(linkOrFolderData.children).map((key) => {
      return { ...linkOrFolderData.children[key], relativePath: key };
    });
    // return as array
    linkOrFolderData.children = Object.values(linkOrFolderData.children);
    // sort by relativePath
    linkOrFolderData.children.sort((a: any, b: any) => {
      if (a.relativePath < b.relativePath) {
        return -1;
      }
      if (a.relativePath > b.relativePath) {
        return 1;
      }
      return 0;
    });
  }
  // 5. hide private data
  // if the user is not the owner and type is folder, hide children if public access is not read or write, and personal access to the user is not read or write
  if (req.headers.username !== username && linkOrFolderData.type === "folder") {
    linkOrFolderData.children = linkOrFolderData.children.filter((child: any) => {
      if (child.publicAccess === "viewer" || child.publicAccess === "editor") {
        return true;
      } else if (child.personalAccess.some((item: any) => item.username === req.headers.username && (item.access === "viewer" || item.access === "editor"))) {
        return true;
      } else {
        return false;
      }
    });
  }
  // 6. add path to link or folder data
  // linkOrFolderData.path = path.split("/").slice(0, -1).join("/");
  linkOrFolderData.path =
    "/" +
    path
      .split("/")
      .filter((path: any) => path !== "")
      .slice(0, -1)
      .join("/");
  linkOrFolderData.relativePath = path.split("/").slice(-1)[0];

  // 7. convert timestamp to date.
  linkOrFolderData.createdAt = linkOrFolderData.createdAt.toDate();
  linkOrFolderData.lastModified = linkOrFolderData.lastModified.toDate();
  if (linkOrFolderData.children) {
    linkOrFolderData.children.forEach((child: any) => {
      child.createdAt = child.createdAt.toDate();
      child.lastModified = child.lastModified.toDate();
    });
  }

  res.json({ status: STATUS_SUCCESS, data: linkOrFolderData });
}
