// const express = require("express");
// const router = express.Router();

// const {
//   getDistricts,
//   getProvinces,
//   getSubDistricts,
// } = require("../Controllers/address");

// router.get("/provinces", getProvinces);
// router.get("/districts", getDistricts);
// router.get("/sub-districts", getSubDistricts);

// module.exports = router;

const express = require("express");
const router = express.Router();

const {
  getProvinces,
  getDistricts,
  getSubDistricts,
  syncDataTest,
} = require("../Controllers/address");

router.get("/address/provinces", getProvinces);
router.get("/address/districts", getDistricts);
router.get("/address/sub-districts", getSubDistricts);
router.get("/address/sync-test", syncDataTest);

module.exports = router;
