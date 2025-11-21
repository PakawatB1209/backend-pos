const express = require("express");
const router = express.Router();

const {
  getOneCompany,
  list,
  createCompany,
  removeOneCompany,
  updateCompany,
} = require("../Controllers/company");

router.get("/comp", list);

router.get("/comp/:id", getOneCompany);

router.post("/comp", createCompany);

router.put("/comp/:id", updateCompany);

router.delete("/comp/:id", removeOneCompany);

module.exports = router;
