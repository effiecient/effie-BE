const isRelativePathValid = (path: string): boolean => {
  // should not be empty, contain only alphanumeric characters and dashes, and not start with a dash
  return /^[a-zA-Z0-9]+[a-zA-Z0-9-]*$/.test(path);
};
function validateBody(body: any) {
  let err: any = undefined;
  let keys = Object.keys(body);
  keys = keys.filter((key) => body[key] !== undefined); // remove undefined
  for (let i = 0; i < keys.length; i++) {
    const key: any = keys[i];
    if (!["username", "link", "path", "relativePath", "title", "isPinned", "newRelativePath", "newPath", "publicAccess", "personalAccess"].includes(key)) {
      err = `Invalid key ${key}`;
      break;
    }
    if (key === "path") {
      let path = body[key];
      if (path[0] !== "/") {
        err = "Path must start with /";
        break;
      } else if (key === "newPath") {
        let newPath = body[key];
        if (newPath[0] !== "/") {
          err = "newPath must start with /";
          break;
        }
      }
    } else if (key === "relativePath") {
      let relativePath = body[key];
      if (!isRelativePathValid(relativePath)) {
        err = "Invalid relative path. Only alphanumeric characters and hyphens are allowed.";
        break;
      }
    } else if (key === "newRelativePath") {
      let newRelativePath = body[key];
      if (!isRelativePathValid(newRelativePath)) {
        err = "Invalid newRelativePath. Only alphanumeric characters and hyphens are allowed.";
        break;
      }
    } else if (key === "link") {
      let link = body[key];
      if (!link.startsWith("http://") && !link.startsWith("https://")) {
        err = "Invalid link. Link must start with http:// or https://";
        break;
      }
      // check if link contain effie.boo. make it case insensitive
      if (link.toLowerCase().includes("effie.boo")) {
        err = "Invalid link. cannot redirect to effie.boo";
        break;
      }
    } else if (key === "publicAccess") {
      let publicAccess = body[key];
      if (publicAccess !== "viewer" && publicAccess !== "editor" && publicAccess !== "none") {
        err = "Invalid publicAccess. Options: viewer, editor, none";
        break;
      }
    } else if (key === "personalAccess") {
      // const validUsername = [];
      // /TODO: get from database

      let personalAccess = body[key];
      if (!Array.isArray(personalAccess)) {
        err = "Invalid personalAccess. Must be an array of objects";
        break;
      }
      for (let i = 0; i < personalAccess.length; i++) {
        if (personalAccess[i].username === undefined || personalAccess[i].access === undefined) {
          err = "Invalid personalAccess. Each object must have username and access";
          break;
        }

        if (personalAccess[i].access !== "viewer" && personalAccess[i].access !== "editor" && personalAccess[i].access !== "none") {
          err = "Invalid personalAccess. Each object's access can only be viewer, editor, or none";
          break;
        }
      }
    }
  }
  return err;
}
export { isRelativePathValid, validateBody };
