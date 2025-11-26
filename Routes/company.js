const express = require("express");
const router = express.Router();
const { auth, adminCheck } = require("../Middleware/auth");

const {
  getOneCompany,
  list,
  createCompany,
  removeOneCompany,
  updateCompany,
} = require("../Controllers/company");

router.get("/comp", list);

router.get("/comp/:id", getOneCompany);

router.post("/comp", auth, adminCheck, createCompany);

router.put("/comp/:id", auth, adminCheck, updateCompany);

router.delete("/comp/:id", auth, adminCheck, removeOneCompany); //ถ้าลบหายยกบอเลยนะ

module.exports = router;
