const express = require("express");
const router = express.Router();

const {
  getCountries,
  getStates,
  getCities,
  getProvinces,
  getDistricts,
  getSubDistricts,

  importStaticData,
  // syncAllAuto,
} = require("../Controllers/address");
router.get("/countries", getCountries);
router.post("/states", getStates);
router.post("/cities", getCities);
// router.get("/address/sync-test", syncAllAuto);
router.get("/address/importStaticData", importStaticData);
router.get("/address/provinces", getProvinces);
router.get("/address/districts", getDistricts);
router.get("/address/sub-districts", getSubDistricts);

module.exports = router;
