const express = require("express");
const router = express.Router();
const { auth } = require("../Middleware/auth");
const { validateSchema } = require("../Middleware/productValidator");
const { upload } = require("../Middleware/upload");

const {
  createProduct,
  getOneProduct,
  list,
  removeOneProduct,
  updateProduct,
} = require("../Controllers/product");

router.get("/product", auth, list);

router.get("/product/:id", getOneProduct);

// router.post("/product", createProduct);
router.post("/master", auth, validateSchema("master"), upload, createProduct);
router.post("/stone", auth, validateSchema("stone"), upload, createProduct);
router.post(
  "/semimount",
  auth,
  validateSchema("semimount"),
  upload,
  createProduct
);
router.post("/others", auth, validateSchema("others"), upload, createProduct);

router.put("/product/:id", updateProduct);

router.delete("/product/:id", removeOneProduct);

module.exports = router;
