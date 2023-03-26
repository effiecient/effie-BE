import { VercelRequest, VercelResponse } from "@vercel/node";
import { getDB, recursiveDeleteDocument } from "../../utils";
import { STATUS_ERROR, STATUS_SUCCESS } from "../../config";

export async function deleteLinkOrFolder(req: any, res: VercelResponse) {
  // can handle unknown path. so /api/directory/username/unknown/path can be handled, /api/directory/username/unknown/path/another/unknown/path can also be handled

  //TODO: check if user is authenticated

  // parse the input and validate
  // read params
  const { username } = req.params;
  // get from header, injected by middleware
  // const { accessorUsername } = req;

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
  if (parentData.childrens[pathArray[pathArray.length - 1]] === undefined) {
    res.status(404).json({ status: STATUS_ERROR, message: "path not found.", path });
    return;
  }
  // TODO: validate: check if the user has access to the link
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
