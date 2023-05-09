const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

function initialize() {
  if (process.env.NODE_ENV === "production") {
    initializeApp({
      credential: cert({
        type: process.env.FIREBASE_TYPE,
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI,
        token_uri: process.env.FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
      }),
    });
  } else {
    initializeApp({
      credential: cert({
        type: process.env.DEV_FIREBASE_TYPE,
        project_id: process.env.DEV_FIREBASE_PROJECT_ID,
        private_key_id: process.env.DEV_FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.DEV_FIREBASE_PRIVATE_KEY,
        client_email: process.env.DEV_FIREBASE_CLIENT_EMAIL,
        client_id: process.env.DEV_FIREBASE_CLIENT_ID,
        auth_uri: process.env.DEV_FIREBASE_AUTH_URI,
        token_uri: process.env.DEV_FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.DEV_FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.DEV_FIREBASE_CLIENT_X509_CERT_URL,
      }),
    });
  }
}

function initializeBoth(){
  // Initilize production
  const prodApp = initializeApp({
    credential: cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    }),
  }, "production");

  // Initilize development
  const devApp = initializeApp({
    credential: cert({
      type: process.env.DEV_FIREBASE_TYPE,
      project_id: process.env.DEV_FIREBASE_PROJECT_ID,
      private_key_id: process.env.DEV_FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.DEV_FIREBASE_PRIVATE_KEY,
      client_email: process.env.DEV_FIREBASE_CLIENT_EMAIL,
      client_id: process.env.DEV_FIREBASE_CLIENT_ID,
      auth_uri: process.env.DEV_FIREBASE_AUTH_URI,
      token_uri: process.env.DEV_FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.DEV_FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.DEV_FIREBASE_CLIENT_X509_CERT_URL,
    }),
  }, "development");
  return { prodApp, devApp}
}

let isInitialized = false;

export function getDB() {
  // initialize if not yet initialized
  if (!isInitialized) {
    initialize();
    isInitialized = true;
  }

  const db = getFirestore();
  return { db };
}

export function getFirebaseAuth() {
  // initialize if not yet initialized
  if (!isInitialized) {
    initialize();
    isInitialized = true;
  }

  const auth = getAuth();
  return { auth };
}

export function getBothDB(){
  // initialize if not yet initialized
  const { prodApp, devApp} = initializeBoth();

  let mainDB = getFirestore(prodApp)
  let devDB = getFirestore(devApp)
  return { mainDB, devDB };
}
