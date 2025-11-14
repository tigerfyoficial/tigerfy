const mongoose = require("mongoose");

const ApiPixSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    key: { type: String, required: true },
    secret: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ApiPix", ApiPixSchema);
