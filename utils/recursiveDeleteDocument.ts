export async function recursiveDeleteDocument(parentRef: any, documentName: string): Promise<{ isDeleted: boolean; error: string }> {
  // delete document

  let documentRef = parentRef.collection("childrens").doc(documentName);

  let documentData = await documentRef.get();
  if (!documentData.exists) {
    return { isDeleted: false, error: "Document doesn't exist: " + documentName };
  }
  documentData = documentData.data();

  // if document is a folder that has childrens, delete the children
  if (documentData.type === "folder" && documentData.childrens) {
    for (let relativePath in documentData.childrens) {
      // if children is folder
      if (documentData.childrens[relativePath].type === "folder") {
        const { isDeleted, error } = await recursiveDeleteDocument(documentRef, relativePath);
        if (!isDeleted) {
          return { isDeleted: false, error };
        }
      }
    }
  }

  // delete document
  await documentRef.delete();

  return { isDeleted: true, error: "" };
}
