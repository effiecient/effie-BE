import { VercelResponse } from "@vercel/node";
import { getDB, recursiveDeleteDocument } from "@/utils";
import { STATUS_ERROR, STATUS_SUCCESS } from "@/config";

export async function deleteLinkOrFolder(req: any, res: VercelResponse) {
  // can handle unknown path. so /api/directory/username/unknown/path can be handled, /api/directory/username/unknown/path/another/unknown/path can also be handled

  //validate: check if user is logged in
  if (!req.headers.username) {
    res.status(401).json({ status: STATUS_ERROR, message: "User not logged in." });
    return;
  }

  // parse the input and validate
  // read params
  const { username } = req.params;

  // read /api/directory/username/* path, remove empty strings
  let pathArray = req.params["0"].split("/").filter((path: any) => path !== "");
  console.log(pathArray);
  const path = "/" + pathArray.join("/");

  // start getting data from firestore
  const { db } = getDB();

  // get rootRef
  const rootRef = db.collection("directories").doc(username);

  // get parentRef
  let parentRef = rootRef;

  pathArray.slice(0, pathArray.length - 1).forEach((relativePath: any) => {
    parentRef = parentRef.collection("childrens").doc(relativePath);
  });
  // get link data
  // validate: check if it exist
  const parent = await parentRef.get();
  if (!parent.exists) {
    res.status(404).json({ status: STATUS_ERROR, message: "path not found.", path });
    return;
  }
  const parentData = parent.data();
  // validate: check if link exist
  const sharedConfig = parentData.childrens[pathArray[pathArray.length - 1]].shareConfiguration;
  if (parentData.childrens[pathArray[pathArray.length - 1]] === undefined) {
    res.status(404).json({ status: STATUS_ERROR, message: "path not found.", path });
    return;
  }
  // validate: check if the user has access. don't have access if it's not his own link and (it's not shared or it's shared but not with write access)
  // there's a bug here. if the user is not the owner, and a folder with private childrens is shared with write access, the user will delete the children also.
  // need to handle this.
  // opt 1. delete all childrens recursively. (what we're doing currently. not good)
  // opt 2. don't allow user to delete folder with private childrens. (expensive)
  // opt 3. don't allow user to create a private childrens in shared folder. (user limitation. I am drawn to this one.)

  if (username !== req.headers.username && (!sharedConfig || sharedConfig.sharedPrivilege !== "write")) {
    res.status(401).json({ status: STATUS_ERROR, message: "User not authorized.", path });
    return;
  }

  // delete based on type
  let type = parentData.childrens[pathArray[pathArray.length - 1]].type;
  if (type === "folder") {
    // delete folder
    const { isDeleted, error } = await recursiveDeleteDocument(parentRef, pathArray[pathArray.length - 1]);
    if (!isDeleted) {
      res.status(500).json({ status: STATUS_ERROR, message: error, path });
      return;
    }
    // delete from parent
    let newChildrens = parentData.childrens;
    delete newChildrens[pathArray[pathArray.length - 1]];
    let newParentData = parentData;
    newParentData.childrens = newChildrens;
    await parentRef.update(newParentData);
  } else if (type === "link") {
    // delete link
    let newChildrens = parentData.childrens;
    delete newChildrens[pathArray[pathArray.length - 1]];

    let newParentData = parentData;
    newParentData.childrens = newChildrens;
    await parentRef.update(newParentData);
  } else {
    // error. doesn't suppose to happen.
    res.status(500).json({ status: STATUS_ERROR, message: "unknown type.", path });
    return;
  }

  // temporary
  return res.status(200).json({ status: STATUS_SUCCESS, message: "link deleted.", path });
}
