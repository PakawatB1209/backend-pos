const express = require("express");
const router = express.Router();

const {
  read,
  list,
  createUser,
  remove,
  update,
  removeall,
  createUsersendEmail,
} = require("../Controllers/user");

router.get("/user", list);

router.get("/user/:id", read);

router.post("/user", createUser);

router.post("/userE", createUsersendEmail);

router.put("/user/:id", update);

router.delete("/user/:id", remove);

router.delete("/user", removeall);

module.exports = router;
