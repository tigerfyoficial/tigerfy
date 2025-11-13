const mongoose = require("mongoose");

const PlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, default: "" },
    deliverable: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Plan", PlanSchema);
