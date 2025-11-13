const mongoose = require("mongoose");

const BotSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    token: { type: String, required: true },
    note: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bot", BotSchema);
