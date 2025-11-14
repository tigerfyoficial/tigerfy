const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));

// === conectar ao MongoDB ===
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Painel conectado ao MongoDB ✅"))
  .catch(err => console.error("Erro Mongo:", err));

// === modelos ===
const User = mongoose.model("User", new mongoose.Schema({
  telegramId: Number,
  username: String,
  firstName: String,
  lastName: String,
  dateJoined: Date,
}));

const Payment = mongoose.model("Payment", new mongoose.Schema({
  telegramId: Number,
  paymentId: String,
  amount: Number,
  status: String,
  date: Date,
}));

// === rotas ===
app.get("/", async (req, res) => {
  const users = await User.find().sort({ dateJoined: -1 });
  const payments = await Payment.find().sort({ date: -1 });
  res.render("dashboard", { users, payments });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log("Painel rodando na porta", PORT));
