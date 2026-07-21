const express = require("express");
const line = require("@line/bot-sdk");
require("dotenv").config();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const app = express();

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    await Promise.all(events.map(handleEvent));
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

  const lines = event.message.text.trim().split("\n");

  let totalGame = 0;
  let totalBB = 0;
  let totalRB = 0;
  let count = 0;

  for (const lineText of lines) {
    const parts = lineText.split(".");

    if (parts.length !== 3) continue;

    const game = Number(parts[0]);
    const bb = Number(parts[1]);
    const rb = Number(parts[2]);

    if (isNaN(game) || isNaN(bb) || isNaN(rb)) continue;

    totalGame += game;
    totalBB += bb;
    totalRB += rb;
    count++;
  }

  if (count === 0) {
    return lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: "入力形式：回転数.BB.RB\n例\n1000.5.5",
    });
  }

  const bbRate = totalBB ? (totalGame / totalBB).toFixed(1) : "-";
  const rbRate = totalRB ? (totalGame / totalRB).toFixed(1) : "-";
  const totalRate =
    totalBB + totalRB
      ? (totalGame / (totalBB + totalRB)).toFixed(1)
      : "-";

  const message =
`【${count}台合算】

総回転数：${totalGame}G
BB：${totalBB}
RB：${totalRB}

BB確率：1/${bbRate}
RB確率：1/${rbRate}
合算：1/${totalRate}`;

  return lineClient.replyMessage(event.replyToken, {
    type: "text",
    text: message,
  });
}

const lineClient = new line.Client(config);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});