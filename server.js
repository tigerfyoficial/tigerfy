const express = require("express");
const session = require("express-session");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const morgan = require("morgan");
const expressLayouts = require("express-ejs-layouts");
require("dotenv").config();

const app = express();

/* ---------- Middlewares base ---------- */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression());
app.use(helmet());
app.use(morgan("tiny"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "tigerfy_secret",
    resave: false,
    saveUninitialized: false,
  })
);

// evita erro de view esperando "active"
app.use((req, res, next) => {
  res.locals.active = "";
  next();
});

/* ---------- EJS + Layout ---------- */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layout");
app.use(expressLayouts);

/* ---------- Static ---------- */
app.use(express.static(path.join(__dirname, "public")));

/* ---------- Health & favicon (evita 500/timeout) ---------- */
app.get("/health", (req, res) => res.status(200).send("ok"));
app.get(["/favicon.ico", "/favicon.png"], (req, res) => res.status(204).end());

/* ---------- Login curto-circuitado (encerra 302 infinito) ---------- */
app.get("/login", (req, res) => {
  return res.render("login", { title: "Login" });
});

/* ---------- Home -> /login ---------- */
app.get("/", (req, res) => res.redirect("/login"));

/* ---------- Rotas ---------- */
app.use("/", require("./routes/auth"));
app.use("/", require("./routes/dashboard"));
app.use("/", require("./routes/offers"));
app.use("/", require("./routes/api_pix"));

/* ---------- 404 ---------- */
app.use((req, res) => {
  res.status(404).render("404", { title: "404 - TigerFy" });
});

/* ---------- Export para Vercel ---------- */
if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => console.log(`🚀 TigerFy rodando! Porta ${PORT}`));
}

module.exports = app;
