import { ShareConfiguration } from "../type/shareConfiguration";

export async function recursiveUpdate(updatedParentRef: any, childrenName: string, ShareConfiguration: ShareConfiguration): Promise<{ isUpdated: boolean; error: string }> {
  let parentData = await updatedParentRef.get();
  if (!parentData.exists) {
    return { isUpdated: false, error: "Root data doesn't exist" };
  }
  parentData = parentData.data();

  // check if children exists
  if (!parentData.childrens[childrenName]) {
    return { isUpdated: false, error: "Children doesn't exist" };
  }
  let updatedParentData = {
    ...parentData,
    childrens: {
      ...parentData.childrens,
      [childrenName]: {
        ...parentData.childrens[childrenName],
        shareConfiguration: {
          ...ShareConfiguration,
        },
      },
    },
  };

  //   update parent
  await updatedParentRef.update(updatedParentData, { merge: true });

  //  if children is a link, update is done
  if (parentData.childrens[childrenName].type === "link") {
    return { isUpdated: true, error: "" };
  }

  // if children is a folder, update the children
  const folderRef = updatedParentRef.collection("childrens").doc(childrenName);
  let folderData = await folderRef.get();
  if (!folderData.exists) {
    return { isUpdated: false, error: "Children data doesn't exist. this shouldn't happen, the data is inconsistent" };
  }
  folderData = folderData.data();
  //   update children
  let updatedFolderData = {
    ...folderData,
    shareConfiguration: {
      ...ShareConfiguration,
    },
  };
  await folderRef.update(updatedFolderData, { merge: true });

  // if folder doesn't have children, update is done
  if (!updatedFolderData.childrens) {
    return { isUpdated: true, error: "" };
  }

  // for every children, update the children
  for (let relativePath in updatedFolderData.childrens) {
    const { isUpdated, error } = await recursiveUpdate(folderRef, relativePath, ShareConfiguration);
    if (!isUpdated) {
      return { isUpdated: false, error };
    }
  }
  return { isUpdated: true, error: "" };
}
