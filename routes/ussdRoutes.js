const express = require("express");
const { handleSession } = require("../controllers/ussdController");

const router = express.Router();


router.post("/ussd", handleSession);


module.exports = router; 
