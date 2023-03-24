import { getDB } from ".";

export async function getUsernameById(uid: string) {
  // returns username for a given uid

  const { db } = getDB();

  const userRef = db.collection("users");

  // check if doc in userRef has name uid
  const userData = await userRef.doc(uid).get();
  if (userData.exists) {
    return userData.data().username;
  } else {
    return null;
  }
}
