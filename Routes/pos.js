const express = require("express");
const router = express.Router();
const { auth } = require("../Middleware/auth");

const {
  getPosItemTypes,
  getPosProducts,
  getPosProductDetail,
  getPosProductsByIds,
} = require("../Controllers/pos");

router.get("/POS/ItemTypes", auth, getPosItemTypes);

router.get("/POS/Product/list", auth, getPosProducts);

router.get("/POS/Product/Detail/:id", auth, getPosProductDetail);

router.get("/POS/Product/Bulk", auth, getPosProductsByIds);

module.exports = router;
