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
  let totalKoyaku = 0;
  let count = 0;

  let dot3Mode = false;
  let dot2Mode = false;
  let dashMode = false;

  for (const line of lines) {

    // 総回転.BB.RB
    if (/^\d+\.\d+\.\d+$/.test(line)) {
      dot3Mode = true;
    }

    // 子役
    if (/^\d+\.\d+$/.test(line)) {
      dot2Mode = true;
    }

    // 合算-BB-RB
    if (/^\d+\-\d+\-\d+$/.test(line)) {
      dashMode = true;
    }
  }

  // モードが混ざっていたら反応しない
  const modeCount =
    Number(dot3Mode) +
    Number(dot2Mode) +
    Number(dashMode);

  if (modeCount !== 1) {
    return null;
  }

  // ========================================
  // 総回転・BB・RBモード
  // 例：
  // 1000.5.5
  // 1000.5.5
  // ========================================
  if (dot3Mode) {

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

  // ========================================
  // 子役モード
  // 例：
  // 1000.5
  // 1000.5
  // ========================================
  else if (dot2Mode) {

    for (const line of lines) {

      if (!/^\d+\.\d+$/.test(line)) {
        continue;
      }

      const [game, koyaku] = line.split(".").map(Number);

      totalGame += game;
      totalKoyaku += koyaku;
      count++;
    }

    if (count < 2) {
      return null;
    }

    const koyakuRate = totalKoyaku > 0
      ? (totalGame / totalKoyaku).toFixed(1)
      : "-";

    const message =
`【${count}台合算】
総回転：${totalGame}G
子役：${totalKoyaku}
子役確率：1/${koyakuRate}`;

    return lineClient.replyMessage(event.replyToken, {
      type: "text",
      text: message,
    });
  }

  // ========================================
  // 合算-BB-RBモード
  // 例：
  // 100-1-1
  // 100-1-1
  // 150-0-0
  // ========================================
  else if (dashMode) {

    for (const line of lines) {

      if (!/^\d+\-\d+\-\d+$/.test(line)) {
        continue;
      }

      const [rate, bb, rb] = line.split("-").map(Number);

      // BB・RBがある場合
      // 合算 × (BB + RB) で総回転を計算
      if (bb + rb > 0) {
        totalGame += rate * (bb + rb);
      }

      // BB・RBが0の場合
      // 合算の数字をそのまま総回転として加算
      else {
        totalGame += rate;
      }

      totalBB += bb;
      totalRB += rb;
      count++;
    }
  }

  if (count < 2) {
    return null;
  }

  const bbRate = totalBB > 0
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