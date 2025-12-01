const express = require("express");
const router = express.Router();

const { auth } = require("../Middleware/auth");
const { validateSchema } = require("../Middleware/productValidator");

const {
  createProductDetail,
  getOneProductDetail,
} = require("../Controllers/product_detail");

// //Product Master
// router.post("/master", auth, validateSchema("master"), createProductDetail);

// //Stone
// router.post("/stone", auth, validateSchema("stone"), createProductDetail);

// //Semi-mount
// router.post(
//   "/semimount",
//   auth,
//   validateSchema("semimount"),
//   createProductDetail
// );

// //Others
// router.post("/others", auth, validateSchema("others"), createProductDetail);

// router.get("/productdetail/:id", getOneProductDetail);

module.exports = router;
