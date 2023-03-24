// used when renaming relativePath

export async function recursiveCloneDocument(parentRef: any, documentName: string, newDocumentName: string, documentPath: string = ""): Promise<{ isCloned: boolean; error: string }> {
  // get document
  let documentRef = parentRef.collection("childrens").doc(documentName);
  for (let path of documentPath.split("/").filter((item: any) => item !== "")) {
    documentRef = documentRef.collection("childrens").doc(path);
  }

  let documentData = await documentRef.get();
  if (!documentData.exists) {
    return { isCloned: false, error: "Document doesn't exist: " + documentName + "/" + documentPath };
  }
  documentData = documentData.data();

  //   check if newDocumentName already exists
  let newDocumentRef = parentRef.collection("childrens").doc(newDocumentName);
  for (let path of documentPath.split("/").filter((item: any) => item !== "")) {
    newDocumentRef = newDocumentRef.collection("childrens").doc(path);
  }

  let newDocumentData = await newDocumentRef.get();
  if (newDocumentData.exists) {
    return { isCloned: false, error: "New document name already exists: " + documentName + "/" + documentPath };
  }

  // create new document
  await newDocumentRef.set({
    ...documentData,
  });

  // if document is a folder that has childrens, clone the children
  if (documentData.type === "folder" && documentData.childrens) {
    for (let relativePath in documentData.childrens) {
      // if children is folder
      if (documentData.childrens[relativePath].type === "folder") {
        const { isCloned, error } = await recursiveCloneDocument(parentRef, documentName, newDocumentName, documentPath + "/" + relativePath);
        if (!isCloned) {
          return { isCloned: false, error };
        }
      }
    }
  }
  return { isCloned: true, error: "" };
}
