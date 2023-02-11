import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDB } from "../helper";

export async function createUsername(req: VercelRequest, res: VercelResponse) {
    // creates username for a given uid
    const { db } = getDB();
    const { uid, username } = req.body;
    if (uid === undefined || username === undefined) {
        res.status(400).send('Missing uid or username');
        return;
    }
    const userCollection = db.collection('users');
    const userRef = userCollection.doc(uid);
    const uidExist = await userCollection.where('uid', '==', uid).get();
    const usernameExist = await userCollection.where('username', '==', username).get();
    if (uidExist.empty === false) {
        res.status(400).send(`User ID '${uid}' already has a username`);
    } else if (usernameExist.empty === false) {
        res.status(400).send(`Username '${username}' already exists`);
    } else {
        await userRef.set({ uid: uid, username: username });
        res.status(200).send(`Username '${username}' for user ID '${uid}' created`);
    }
}

export async function readUsername(req: VercelRequest, res: VercelResponse) {
    // returns username for a given uid

    const { db } = getDB();
    const { uid = "example" } = req.query;

    const userCollection = db.collection('users');
    const usernameExist = await userCollection.where('uid', '==', uid).get();
    if (usernameExist.empty === true) {
        res.status(400).send(`User ID '${uid}' does not have a username`);
    } else {
        const userData = usernameExist.docs[0].data();
        res.status(200).send(userData);
    }
}

export async function readAllUsername(req: VercelRequest, res: VercelResponse) {
    // returns all usernames
    const { db } = getDB();

    const userCollection = db.collection('users');
    const usersRef = await userCollection.get();
    if (usersRef.empty === true) {
        res.status(400).send(`No user found`);
    }
    else {
        const userData = usersRef.docs.map((doc : any) => doc.data());
        res.status(200).send(userData);
    }
}

export async function updateUsername(req: VercelRequest, res: VercelResponse) {
    // updates username for a given uid
    const { db } = getDB();
    const { uid, username } = req.body;
    if (uid === undefined || username === undefined) {
        res.status(400).send('Missing uid or username');
        return;
    }

    const userCollection = db.collection('users');
    const userRef = userCollection.doc(uid);
    const doc = await userRef.get();
    if (!doc.exists) {
        res.status(400).send(`User ID '${uid}' not found`);
    } else {
        await userRef.update({ username: username });
        res.status(200).send(`Username for user ID '${uid}' updated to '${username}'`);
    }
}

export async function deleteUsername(req: VercelRequest, res: VercelResponse) {
    // deletes username for a given uid
    const { db } = getDB();
    const { uid } = req.body;
    if (uid === undefined) {
        res.status(400).send('Missing uid');
        return;
    }

    const userCollection = db.collection('users');
    const userRef = userCollection.doc(uid);
    const doc = await userRef.get();
    if (!doc.exists) {
        res.status(400).send(`User ID '${uid}' not found`);
    } else {
        await userRef.delete();
        res.status(200).send(`Username for user ID '${uid}' deleted`);
    }
}