import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";
import utils from "../../utils";

//   example data
// const username = "christojeffrey";

// const path = "/";
// const relativePath = "searchEngines";
// const title = "Search Engines";
// const isPinned = false;

// MUST HAVE USERNAME AND PATH

// example data
// const body = {
//     username: "christojeffrey",
//     path: "/",
//     relativePath: "a",
//     isPinned: false,
// }

export async function updateFolder(req: VercelRequest, res: VercelResponse) {
  // const { username, path, relativePath, title, isPinned } = req.body;

  // temporary data
  const username = "christojeffrey";
  const path = "/itb";
  const relativePath = "semester-6";
  const isPinned = true;
  if (!username || !path || !relativePath) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body",
    });
    return;
  }

  //   check if path start with /
  if (path[0] !== "/") {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid path",
    });
    return;
  }
  //   get the db
  const { db } = utils.getDB();
  // get the parent of the link ref
  // turn path from "/" or "/testing"or "/testing/another" ["testing", "another"]
  let pathArray = path.split("/").filter((item: any) => item !== "");
  // append relative path to pathArray

  const directoryRootRef = db.collection("directories").doc(username);
  let parentRef = directoryRootRef;
  // get parent
  for (let i = 0; i < pathArray.length; i++) {
    const pathItem = pathArray[i];
    const childRef = parentRef.collection("childrens").doc(pathItem);
    const childData = await childRef.get();
    console.log(childData.data());
    if (!childData.exists) {
      // if folder doesn't exist, break and return error
      res.status(404).json({
        status: STATUS_ERROR,
        message: "Folder not found",
      });
      return;
    }
    parentRef = childRef;
  }

  // parentRef is now the folder to be updated
  let folderData = await parentRef.get();
  folderData = folderData.data();

  console.log(folderData);

  // add the folder to the parent
  // const folderData = {
  //   title: body.title,
  //   isPinned,
  //   type: "folder",
  // };

  // update the parent
  await parentRef.update(folderData, { merge: true });

  // create a new documents inside the childrens collection
  // const folderRef = parentRef.collection("childrens").doc(relativePath);

  // await folderRef.set({
  //   title,
  //   isPinned,
  //   type: "folder",
  // });

  res.status(200).json({
    status: STATUS_SUCCESS,
    data: folderData,
  });
}
