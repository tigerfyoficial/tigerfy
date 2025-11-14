const express = require("express");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const morgan = require("morgan");
const expressLayouts = require("express-ejs-layouts");
const cookieSession = require("cookie-session");
require("dotenv").config();

const app = express();

// Vercel/Proxies: necessário para cookies "secure"
app.set("trust proxy", 1);

// Middlewares básicos
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression());
app.use(helmet());
app.use(morgan("tiny"));

// Sessão via cookie (persistente no browser)
app.use(
  cookieSession({
    name: "tigerfy.sess",
    keys: [process.env.SESSION_SECRET || "tigerfy_secret"],
    secure: process.env.NODE_ENV === "production", // HTTPS na Vercel
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  })
);

// Variáveis globais para EJS
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

// Home -> login
app.get("/", (req, res) => res.redirect("/login"));

// Rotas
app.use("/", require("./routes/auth"));
app.use("/", require("./routes/dashboard"));
app.use("/", require("./routes/offers"));
app.use("/", require("./routes/api_pix"));

// (Opcional) Diagnóstico temporário — remover depois
app.get("/whoami", (req, res) => {
  res.json({
    hasSession: !!req.session,
    session: req.session || null
  });
});

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
