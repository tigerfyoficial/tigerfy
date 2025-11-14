const express = require("express");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const morgan = require("morgan");
const expressLayouts = require("express-ejs-layouts");
const cookieSession = require("cookie-session");
require("dotenv").config();

const app = express();

// Middlewares básicos
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression());
app.use(helmet());
app.use(morgan("tiny"));

// Sessão via cookie (compatível com serverless)
app.use(
  cookieSession({
    name: "tigerfy.sess",
    keys: [process.env.SESSION_SECRET || "tigerfy_secret"],
    secure: process.env.NODE_ENV === "production", // true na Vercel (https)
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
  })
);

// Evita erro de 'active undefined' nos templates
app.use((req, res, next) => {
  res.locals.active = "";
  next();
});

// EJS + Layout
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layout");
app.use(expressLayouts);

// Arquivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// Home -> login (ajuste se preferir /deck)
app.get("/", (req, res) => res.redirect("/login"));

// Rotas
app.use("/", require("./routes/auth"));
app.use("/", require("./routes/dashboard"));
app.use("/", require("./routes/offers"));
app.use("/", require("./routes/api_pix"));

// 404
app.use((req, res) => {
  res.status(404).render("404", { title: "404 - TigerFy" });
});

// Export compatível com Vercel
if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => console.log(`🚀 TigerFy rodando! Porta ${PORT}`));
}

module.exports = app;
