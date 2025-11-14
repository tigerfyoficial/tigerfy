// server.js
const express = require("express");
const session = require("express-session");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const morgan = require("morgan");
const expressLayouts = require("express-ejs-layouts");
const authGate = require("./middleware/authGuard");
require("dotenv").config();

const app = express();

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compression());
app.use(helmet());
app.use(morgan("tiny"));

// Sessão (MemoryStore só para dev — depois trocamos por cookie/redis)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "tigerfy_secret",
    resave: false,
    saveUninitialized: false,
  })
);

// EVITA ERRO "active undefined"
app.use((_, res, next) => {
  res.locals.active = "";
  next();
});

// EJS + Layout
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layout");
app.use(expressLayouts);

// Public
app.use(express.static(path.join(__dirname, "public")));

// Health e Debug
app.get("/health", (_, res) => res.json({ ok: true, at: new Date().toISOString() }));
app.get("/debug", (req, res) =>
  res.json({ at: new Date().toISOString(), user: req.session?.user || null })
);

// HOME -> /login
app.get("/", (_, res) => res.redirect("/login"));

// ROTAS PÚBLICAS primeiro
app.use("/", require("./routes/auth"));

// ROTAS PRIVADAS com gate
app.use("/", authGate, require("./routes/dashboard"));
app.use("/", authGate, require("./routes/offers"));
app.use("/", authGate, require("./routes/api_pix"));

// Favicon “no-op” para não poluir logs
app.get(["/favicon.ico", "/favicon.png"], (_, res) => res.status(204).end());

// 404
app.use((_, res) => res.status(404).render("404", { title: "404 - TigerFy" }));

// Export para Vercel
if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => console.log(`🚀 TigerFy rodando! Porta ${PORT}`));
}
