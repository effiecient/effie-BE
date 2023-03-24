type UpdatedData = {
  sharedConfig?: {
    isShared: boolean;
    sharedPrivilege: "read" | "write";
  };
};
export async function recursiveUpdate(db: any, updateRootRef: any, updatedData: UpdatedData): Promise<{ isUpdated: boolean; error: string }> {
  let rootData = await updateRootRef.get();
  if (!rootData.exists) {
    return { isUpdated: false, error: "Root data doesn't exist" };
  }
  rootData = rootData.data();
  let updatedRootData = { ...rootData, ...updatedData };

  //   update parent
  await updateRootRef.update(updatedRootData, { merge: true });

  if (!rootData.childrens) {
    return { isUpdated: true, error: "" };
  }
  //   update parent children

  // for every children, update the children
  for (let relativePath in rootData.childrens) {
    updatedRootData.childrens[relativePath] = {
      ...updatedRootData.childrens[relativePath],
      ...updatedData,
    };
  }
  await updateRootRef.update(updatedRootData, { merge: true });
  //   update the children collections
  // for every children, update the children
  for (let relativePath in rootData.childrens) {
    if (rootData.childrens[relativePath].type === "folder") {
      const childRef = updateRootRef.collection("childrens").doc(relativePath);
      const { isUpdated, error } = await recursiveUpdate(db, childRef, updatedData);
      if (!isUpdated) {
        return { isUpdated: false, error };
      }
    }
  }
  return { isUpdated: true, error: "" };
}
