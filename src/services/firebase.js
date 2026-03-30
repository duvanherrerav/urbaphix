import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyC7x1Bc8jjW3sA9JUvRpGMfSgQeCypstmM",
  authDomain: "urbaphix-b7e10.firebaseapp.com",
  projectId: "urbaphix-b7e10",
  storageBucket: "urbaphix-b7e10.firebasestorage.app",
  messagingSenderId: "213323509730",
  appId: "1:213323509730:web:094a7a6e6dc1be08c993bb",
  measurementId: "G-HLZN2BQ7LH"
};

const app = initializeApp(firebaseConfig);

export const messaging = getMessaging(app);