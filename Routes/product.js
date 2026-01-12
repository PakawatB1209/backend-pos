const express = require("express");
const router = express.Router();
const { auth } = require("../Middleware/auth");
const { validateSchema } = require("../Middleware/productValidator");
const { upload } = require("../Middleware/upload");
const { checkPermission } = require("../Middleware/checkPermission");
const parseBodyData = require("../Middleware/parseBodyData");

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

router.get("/product/:id", auth, getOneProduct);

router.post(
  "/master",
  auth,
  upload,
  parseBodyData,
  validateSchema("master"),
  createProduct
);
router.post(
  "/stone",
  auth,
  upload,
  parseBodyData,
  validateSchema("stone"),
  createProduct
);
router.post(
  "/semimount",
  auth,
  upload,
  parseBodyData,
  validateSchema("semimount"),
  createProduct
);
router.post(
  "/accessory",
  auth,
  upload,
  parseBodyData,
  validateSchema("accessory"),
  createProduct
);

router.post(
  "/others",
  auth,
  upload,
  parseBodyData,
  validateSchema("others"),
  createProduct
);

router.put(
  "/update-product/:id",
  auth,
  upload,
  validateSchema("update"),
  updateProduct
);

router.put("/update/product/status/:id", auth, changeStatus);

router.delete("/del-productOne/:id", auth, removeOneProduct);

router.delete("/del-productAll", auth, removeAllProducts);

router.put("/remove-file/:id", auth, removeSingleFile);

router.put("/remove-all-files/:id", auth, removeAllFiles);

module.exports = router;
