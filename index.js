import TelegramBot from "node-telegram-bot-api";
import admin from "firebase-admin";

// ==============================
// 🔐 ENV VARIABLES
// ==============================

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;

// ==============================
// 🔥 INIT FIREBASE
// ==============================

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY
  }),
  databaseURL: FIREBASE_DB_URL
});

const db = admin.database();

// ==============================
// 🤖 TELEGRAM BOT
// ==============================

const bot = new TelegramBot(TELEGRAM_TOKEN, {
  polling: true
});

console.log("🚀 Samijaya Chatbot running...");

// ==============================
// 🧠 LISTENER USER → TELEGRAM
// ==============================

const activeListeners = new Set();

db.ref("chats").on("child_added", (snapshot) => {
  const sessionId = snapshot.key;

  if (activeListeners.has(sessionId)) return;
  activeListeners.add(sessionId);

  db.ref(`chats/${sessionId}/profile/name`).once("value", (nameSnap) => {
    const name = nameSnap.val() || "Customer";

    db.ref(`chats/${sessionId}/messages`)
      .limitToLast(1)
      .on("child_added", (msgSnap) => {
        const msg = msgSnap.val();

        if (!msg || msg.sender !== "user") return;

        const text = `
🆕 Chat Masuk - Kopi Samijaya

👤 ${name}
🆔 ${sessionId}

💬 ${msg.text}
        `;

        bot.sendMessage(TELEGRAM_CHAT_ID, text.trim());
      });
  });
});

// ==============================
// 🔁 TELEGRAM REPLY → FIREBASE
// ==============================

bot.on("message", async (msg) => {
  try {
    if (!msg.reply_to_message) return;

    const originalText = msg.reply_to_message.text;
    const replyText = msg.text;

    if (!originalText || !replyText) return;

    const match = originalText.match(/🆔 (USR-\w+)/);

    if (!match) {
      console.log("❌ Session ID tidak ditemukan");
      return;
    }

    const sessionId = match[1];

    console.log(`📤 Reply ke ${sessionId}: ${replyText}`);

    await db.ref(`chats/${sessionId}/messages`).push({
      sender: "admin",
      text: replyText,
      timestamp: Date.now()
    });

  } catch (err) {
    console.error("❌ Error:", err);
  }
});
