// used when renaming relativePath

export async function recursiveCloneDocument(collectionRef: any, documentName: string, newDocumentName: string): Promise<{ isCloned: boolean; error: string }> {
  // get document
  const documentRef = collectionRef.doc(documentName);
  let documentData = await documentRef.get();
  if (!documentData.exists) {
    return { isCloned: false, error: "Document doesn't exist" };
  }
  documentData = documentData.data();

  //   check if newDocumentName already exists
  const newDocumentRef = collectionRef.doc(newDocumentName);
  let newDocumentData = await newDocumentRef.get();
  if (newDocumentData.exists) {
    return { isCloned: false, error: "New document name already exists" };
  }

  // create new document
  await collectionRef.doc(newDocumentName).set(documentData);

  // if document is a folder that has childrens, clone the children
  if (documentData.type === "folder" && documentData.childrens) {
    const childrensRef = documentRef.collection("childrens");
    for (let relativePath in documentData.childrens) {
      // if children is folder
      if (documentData.childrens[relativePath].type === "folder") {
        const { isCloned, error } = await recursiveCloneDocument(childrensRef, relativePath, relativePath);
        if (!isCloned) {
          return { isCloned: false, error };
        }
      }
    }
  }
  return { isCloned: true, error: "" };
}
