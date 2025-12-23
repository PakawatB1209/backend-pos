const express = require("express");
const router = express.Router();
const { upload } = require("../Middleware/upload");
const { auth, adminCheck } = require("../Middleware/auth");

const {
  getOneCompany,
  list,
  createCompany,
  removeOneCompany,
  updateCompany,
} = require("../Controllers/company");

router.get("/comp", list);

router.get("/getone-comp/:id", getOneCompany);

router.post("/create-comp", auth, adminCheck, upload, createCompany);

router.put("/update-comp/:id", auth, adminCheck, upload, updateCompany);

router.delete("/remove-comp/:id", auth, adminCheck, removeOneCompany); //ถ้าลบหายยกบอเลยนะ

module.exports = router;
