const express = require("express");

const router = express.Router();
const paralegalAccountController = require("./../controllers/paralegalAccountController");

router
  .route("/getExecutedParalegalClients")
  .get(paralegalAccountController.getExecutedParalegalClients);

router.post("/onLogin", paralegalAccountController.onLogin);


router
  .route("/getParalegalCases")
  .get(paralegalAccountController.getParalegalCases);
router
  .route("/getParalegalCaseDetails")
  .get(paralegalAccountController.getParalegalCaseDetails);
router
  .route("/getExecutedParalegalClientCases")
  .get(paralegalAccountController.getExecutedParalegalClientCases);
router
  .route("/getClientCaseDetails")
  .post(paralegalAccountController.getClientCaseDetails);
  router
  .route("/getParalegalClientCases")
  .post(paralegalAccountController.getParalegalClientCases);
router
  .route("/getParalegalClients")
  .get(paralegalAccountController.getParalegalClients);
router
  .route("/getExecutedParalegalClientCases")
  .get(paralegalAccountController.getExecutedParalegalClientCases);
router
  .route("/acceptCaseReferral")
  .post(paralegalAccountController.acceptCaseReferral);
router
  .route("/declineCaseReferral")
  .post(paralegalAccountController.declineCaseReferral);
router
  .route("/updateParalegalAccount")
  .post(paralegalAccountController.updateParalegalAccount);
router
  .route("/changeParalegalAccountPassword")
  .post(paralegalAccountController.changeParalegalAccountPassword);
router
  .route("/getAccountRecoveryQuestion")
  .post(paralegalAccountController.getAccountRecoveryQuestion);
router
  .route("/verifyRecoveryQuestionAnswer")
  .post(paralegalAccountController.verifyRecoveryQuestionAnswer);
router.route("/sendEmail").get(paralegalAccountController.sendEmail);
router
  .route("/allowNotifications")
  .post(paralegalAccountController.allowNotifications);

router.route("/getCaseFiles").get(paralegalAccountController.getCaseFiles);

// router
//   .route("/postCaseFile")
//   .post(
//     paralegalAccountController.uploadFile,
//     paralegalAccountController.postCaseFile
//   );
router
  .route("/postCaseFile")
  .post(
    paralegalAccountController.uploadGCS,
 
  );
router.route("/closeCase").post(paralegalAccountController.closeCase);
router
  .route("/refercaseToParalegal")
  .post(paralegalAccountController.referCaseToParalegal);
router
  .route("/refercaseToLasp")
  .post(paralegalAccountController.referCaseToLasp);

router
  .route("/getParalegalCaseReferrals")
  .get(paralegalAccountController.getParalegalCaseReferrals);
  router
  .route("/getParalegals")
  .get(paralegalAccountController.getAllParalegals);

module.exports = router;
