const express = require("express");

const router = express.Router();
const iimsController = require("./../controllers/iimsController");
const paralegalAccountController = require("./../controllers/paralegalAccountController");
// router.route("/iims_getCaseReferrals").get(iimsController.iims_getCaseReferrals);

router.post(
  "/iims_createParalegalReferral",
  iimsController.iims_createParalegalReferral
);
router.post("/iims_createLapsReferral", iimsController.iims_createLapsReferral);

router.post("/iims_editReferral", iimsController.iims_editReferral);
router.get("/iims_deleteReferral", iimsController.iims_deleteReferral);
router.get("/iims_getReferralDetails", iimsController.iims_getReferralDetails);

router.post("/iims_registerParalegal", iimsController.iims_registerParalegal);
router.get("/iims_deleteParalegal", iimsController.iims_deleteParalegal);
router.get(
  "/iims_viewParalegalReferrals",
  iimsController.iims_viewParalegalReferrals
);
router.get(
  "/iims_fetchParalegalAccountDetails",
  iimsController.iims_fetchParalegalAccountDetails
);
router.post("/iims_editParalegal", iimsController.iims_editParalegal);
router.post("/iims_report_case", iimsController.reportCase);
router.get(
  "/activateParalegalAccount",
  iimsController.activateParalegalAccount
);
router.get(
  "/deactivateParalegalAccount",
  iimsController.deactivateParalegalAccount
);
router.get("/acceptCaseReferral", iimsController.acceptCaseReferal);
router.post("/declineCaseReferral", iimsController.declineCaseReferral);
router.post("/closeCase", iimsController.closeCase);
router.post(
  "/postCaseFile",
 iimsController.uploadGCS
);
// router.post(
//   "/postCaseFile",
//   paralegalAccountController.uploadFile,
//   iimsController.postCaseFile
// );

router.get(
  "/viewCaseFiles",
  iimsController.getCaseFiles
);

// router
//   .route("/postCaseFile")
//   .post(
//     paralegalAccountController.uploadFile,
//     iimsController.postCaseFile
//   );

// router.post("/iims_registerParalegal", iimsController.createParalegal);

module.exports = router;
