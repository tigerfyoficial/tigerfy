const mongoose = require("mongoose");

const AuthSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    token: String,
    expiresAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("Auth", AuthSchema);
