const express = require("express");
const router = express.Router();
const ApiPix = require("../models/ApiPix");

function auth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

router.get("/api_pix", auth, async (req, res) => {
  try {
    const adquirentes = await ApiPix.find({ owner: req.session.userId }).sort({
      createdAt: -1,
    });

    res.render("api_pix", {
      title: "Adquirentes - TigerFy",
      adquirentes,
      active: "api_pix",
    });
  } catch (err) {
    console.error("Erro api pix:", err);
    res.status(500).send("erro ao carregar adquirentes");
  }
});

router.post("/api_pix/add", auth, async (req, res) => {
  try {
    const { provider, key, secret } = req.body;

    await ApiPix.create({
      provider,
      key,
      secret,
      owner: req.session.userId,
    });

    res.redirect("/api_pix");
  } catch (err) {
    console.error("Erro add pix:", err);
    res.status(500).send("erro ao adicionar adquirente");
  }
});

module.exports = router;
