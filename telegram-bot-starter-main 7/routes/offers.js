const express = require("express");
const router = express.Router();
const Offer = require("../models/Offer");

function auth(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

router.get("/bots", auth, async (req, res) => {
  try {
    const offers = await Offer.find({ owner: req.session.userId }).sort({
      createdAt: -1,
    });

    res.render("bots", {
      title: "Minhas Ofertas - TigerFy",
      offers,
      active: "bots",
    });
  } catch (err) {
    console.error("Erro carregar ofertas:", err);
    res.status(500).send("Erro ao carregar ofertas.");
  }
});

router.get("/bots/create", auth, (req, res) => {
  res.render("bots_create", {
    title: "Criar Oferta - TigerFy",
    active: "bots",
  });
});

router.post("/bots/create", auth, async (req, res) => {
  try {
    const { name, botType, trackingType } = req.body;

    await Offer.create({
      owner: req.session.userId,
      name,
      botType,
      trackingType,
    });

    res.redirect("/bots");
  } catch (err) {
    console.error("Erro criar oferta:", err);
    res.send("Erro ao criar oferta.");
  }
});

module.exports = router;
