const express = require("express");
const router = express.Router();

const {
  createStock,
  getOneStock,
  list,
  removeOneStock,
  updateStock,
} = require("../Controllers/stock");

router.get("/stock", list);

router.get("/stock/:id", getOneStock);

router.post("/stock", createStock);

router.put("/stock/:id", updateStock);

router.delete("/stock/:id", removeOneStock);

module.exports = router;
