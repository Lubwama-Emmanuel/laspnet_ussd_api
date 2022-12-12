const express = require("express");

const router = express.Router();
const registrationController = require("./../controllers/registrationController");

router.route("/getSubcounties").get(registrationController.getSubCounties);
router.get("/getRegions", registrationController.getRegions);
router.get("/getDistricts", registrationController.getDistricts);
router.get("/getLanguages", registrationController.getLanguages);
router.get("/getLaspnetFirms", registrationController.getLaspnetFirms);
router.get(
  "/getDistrictsWithRegions",
  registrationController.getDistrictsWithRegions
);
router.post("/createParalegal", registrationController.createParalegal);

module.exports = router; 
