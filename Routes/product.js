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
  exportProductToExcel,
} = require("../Controllers/product");

router.get("/product/all", auth, checkPermission("Product List", "view"), list);

router.get(
  "/product/:id",
  auth,
  checkPermission("Product List", "view"),
  getOneProduct,
);

router.post(
  "/product/export/excel",
  auth,
  checkPermission("Product List", "export"),
  exportProductToExcel,
);

router.post(
  "/master",
  auth,
  checkPermission("Product Master", "add"),
  upload,
  parseBodyData,
  validateSchema("master"),
  createProduct,
);
router.post(
  "/stone",
  auth,
  checkPermission("Stone", "add"),
  upload,
  parseBodyData,
  validateSchema("stone"),
  createProduct,
);
router.post(
  "/semimount",
  auth,
  checkPermission("Semi-Mount", "add"),
  upload,
  parseBodyData,
  validateSchema("semimount"),
  createProduct,
);
router.post(
  "/accessory",
  auth,
  checkPermission("Accessories", "add"),
  upload,
  parseBodyData,
  validateSchema("accessory"),
  createProduct,
);

router.post(
  "/others",
  auth,
  checkPermission("Others", "add"),
  upload,
  parseBodyData,
  validateSchema("others"),
  createProduct,
);

router.put(
  "/update-product/:id",
  auth,
  checkPermission("Product List", "update"),
  upload,
  parseBodyData,
  validateSchema("update"),
  updateProduct,
);

router.put(
  "/update/product/status/:id",
  auth,
  checkPermission("Product List", "update"),
  changeStatus,
);

router.delete(
  "/del-productOne/:id",
  auth,
  checkPermission("Product List", "delete"),
  removeOneProduct,
);

router.delete(
  "/del-productAll",
  auth,
  checkPermission("Product List", "delete"),
  removeAllProducts,
);

router.put(
  "/remove-file/:id",
  auth,
  checkPermission("Product List", "delete"),
  removeSingleFile,
);

router.put(
  "/remove-all-files/:id",
  auth,
  checkPermission("Product List", "delete"),
  removeAllFiles,
);

module.exports = router;
