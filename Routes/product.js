const express = require("express");
const router = express.Router();
const { auth } = require("../Middleware/auth");
const { validateSchema } = require("../Middleware/productValidator");
const { upload } = require("../Middleware/upload");
const { checkPermission } = require("../Middleware/checkPermission");

const {
  createProduct,
  getOneProduct,
  list,
  removeOneProduct,
  updateProduct,
  changeStatus,
  removeAllProducts,
  removeSingleFile,
  removeAllFiles,
} = require("../Controllers/product");

router.get("/product/all", auth, checkPermission("Product List", "view"), list);

router.get("/product/:id", getOneProduct);

router.post("/master", auth, validateSchema("master"), upload, createProduct);
router.post("/stone", auth, validateSchema("stone"), upload, createProduct);
router.post(
  "/semimount",
  auth,
  validateSchema("semimount"),
  upload,
  createProduct
);
router.post(
  "/accessory",
  auth,
  validateSchema("accessory"),
  upload,
  createProduct
);

router.post("/others", auth, validateSchema("others"), upload, createProduct);

router.put(
  "/update-product/:id",
  auth,
  validateSchema("update"),
  updateProduct
);

router.put("/update/product/status/:id", auth, changeStatus);

router.delete("/del-productOne/:id", auth, removeOneProduct);

router.delete("/del-productAll", auth, removeAllProducts);

router.put("/remove-file/:id", auth, removeSingleFile);

router.put("/remove-all-files/:id", auth, removeAllFiles);

module.exports = router;
