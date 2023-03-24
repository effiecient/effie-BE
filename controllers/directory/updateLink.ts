import type { VercelRequest, VercelResponse } from "@vercel/node";
import { STATUS_SUCCESS, STATUS_ERROR } from "../../config";
import utils from "../../utils";

// example of complete data
// MUST HAVE USERNAME PATH and RELATIVE PATH
// const username = "christojeffrey";
// const path = "/";
// const relativePath = "bing";
// data below is optional. at least one of them must be provided
// const link = "https://bing.com";
// const title = "Bing";
// const isPinned = false;
// const newRelativePath = "bing2";

export async function updateLink(req: VercelRequest, res: VercelResponse) {
  const { username, path, relativePath, link, title, isPinned, newRelativePath } = req.body;

  if (!username || !path || !relativePath) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body. Username, path, and relativePath must be provided",
    });
    return;
  }

  // check if at least one of the data is provided
  if (!isPinned && !title && !newRelativePath && !link) {
    res.status(400).json({
      status: STATUS_ERROR,
      message: "Invalid body. At least one of the data must be provided (isPinned, title, newRelativePath, link)",
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
  console.log(pathArray);

  const directoryRootRef = db.collection("directories").doc(username);
  let parentRef = directoryRootRef;

  // get parent
  for (let i = 0; i < pathArray.length; i++) {
    const pathItem = pathArray[i];
    const childRef = parentRef.collection("childrens").doc(pathItem);
    parentRef = childRef;
  }
  let parentData = await parentRef.get();
  if (!parentData.exists) {
    // if folder doesn't exist, break and return error
    res.status(404).json({
      status: STATUS_ERROR,
      message: "Parent not found.",
    });
    return;
  }

  // at this point, we have valid parent

  parentData = parentData.data();

  // 1. update the link in the parents children
  let updatedParentData = parentData;
  updatedParentData.childrens[relativePath] = {
    ...updatedParentData.childrens[relativePath],
    ...{
      link: link ? link : updatedParentData.childrens[relativePath].link,
      title: title ? title : updatedParentData.childrens[relativePath].title,
      isPinned: isPinned ? isPinned : updatedParentData.childrens[relativePath].isPinned,
    },
  };
  // handle new relative path.
  if (newRelativePath) {
    // check if newRelativePath is valid, which means it doesn't exist in the parent
    if (updatedParentData.childrens[newRelativePath]) {
      res.status(400).json({
        status: STATUS_ERROR,
        message: "Invalid newRelativePath. It already exists in the parent",
      });
      return;
    }
    // if valid, update the parent
    updatedParentData.childrens[newRelativePath] = updatedParentData.childrens[relativePath];
    // delete the old relative path
    delete updatedParentData.childrens[relativePath];
  }

  parentRef.update(updatedParentData, { merge: true });

  res.status(200).json({
    status: STATUS_SUCCESS,
    data: updatedParentData.childrens[newRelativePath] ? updatedParentData.childrens[newRelativePath] : updatedParentData.childrens[relativePath],
  });
}
