const express = require("express");
const line = require("@line/bot-sdk");
require("dotenv").config();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const lineClient = new line.Client(config);
const app = express();

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return null;
  }

  const lines = event.message.text
    .trim()
    .split(/\r?\n/)
    .map(v => v.trim())
    .filter(v => v !== "");

  // 2行未満なら反応しない
  if (lines.length < 2) {
    return null;
  }

  let totalGame = 0;
  let totalBB = 0;
  let totalRB = 0;
  let count = 0;

  let dotMode = false;
  let dashMode = false;

  for (const line of lines) {
    if (/^\d+\.\d+\.\d+$/.test(line)) {
      dotMode = true;
    }

    if (/^\d+\-\d+\-\d+$/.test(line)) {
      dashMode = true;
    }
  }

  // 「.」と「-」が混ざっていたら反応しない
  if (dotMode && dashMode) {
    return null;
  }

  // ---------- 総回転モード ----------
  if (dotMode) {

    for (const line of lines) {

      if (!/^\d+\.\d+\.\d+$/.test(line)) {
        continue;
      }

      const [game, bb, rb] = line.split(".").map(Number);

      totalGame += game;
      totalBB += bb;
      totalRB += rb;
      count++;
    }

  }

  // ---------- 合算モード ----------
  else if (dashMode) {

    for (const line of lines) {

      if (!/^\d+\-\d+\-\d+$/.test(line)) {
        continue;
      }

      const [rate, bb, rb] = line.split("-").map(Number);

      totalGame += rate * (bb + rb);
      totalBB += bb;
      totalRB += rb;
      count++;
    }

  } else {
    return null;
  }

  if (count < 2) {
    return null;
  }  const bbRate = totalBB > 0
    ? (totalGame / totalBB).toFixed(1)
    : "-";

  const rbRate = totalRB > 0
    ? (totalGame / totalRB).toFixed(1)
    : "-";

  const totalRate = (totalBB + totalRB) > 0
    ? (totalGame / (totalBB + totalRB)).toFixed(1)
    : "-";

  const message =
`【${count}台合算】
総回転：${totalGame}G
BB：${totalBB}　RB：${totalRB}
BB確率：1/${bbRate}
RB確率：1/${rbRate}
合算：1/${totalRate}`;

  return lineClient.replyMessage(event.replyToken, {
    type: "text",
    text: message,
  });
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});