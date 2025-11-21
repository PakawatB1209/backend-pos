const express = require("express");
const router = express.Router();

const {
  createProduct,
  getOneProduct,
  list,
  removeOneProduct,
  updateProduct,
} = require("../Controllers/product");

router.get("/product", list);

router.get("/product/:id", getOneProduct);

router.post("/product", createProduct);

router.put("/product/:id", updateProduct);

router.delete("/product/:id", removeOneProduct);

module.exports = router;
