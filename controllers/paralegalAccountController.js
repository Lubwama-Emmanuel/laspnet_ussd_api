const catchAsync = require("./../utils/catchAsync");
const AppError = require("./../utils/appError");
const db = require("./../utils/config");
const bcrypt = require("bcryptjs");
const lib = require("./../utils/lib");
const multer = require("multer");
const util = require("util");
const { Storage } = require("@google-cloud/storage");
const { format } = require("util");
const maxSize = 5 * 1024 * 1024;
///handle gcp file upload
let processFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSize },
}).single("file");
let processFileMiddleware = util.promisify(processFile);

exports.uploadGCS = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }
  await processFileMiddleware(req, res);
  if (!req.file) {
    return next(new AppError("please attach file", 400));
  }
  let file = req.file;

  const storage = new Storage({ keyFilename: "google-cloud-key.json" });
  const bucket = storage.bucket("case_files");
  let fileName = file.originalname;

  fileName = `${Date.now()}` + fileName;
  const blob = bucket.file(fileName);
  const blobStream = blob.createWriteStream({
    resumable: false,
  });

  blobStream.on("error", (err) => {
    res.status(500).send({ message: err.message });
  });

  blobStream.on("finish", async (data) => {
    // Create URL for directly file access via HTTP.
    const publicUrl = format(
      `https://storage.googleapis.com/${bucket.name}/${blob.name}`
    );

    console.log("the blob and url",publicUrl,blob.name);
    // try {
    //   // Make the file public
    //   await bucket.file(req.file.originalname).makePublic();
    //   console.log("sucessfully made url public")
    // } catch {
    //   return res.status(500).send({
    //     message: `Uploaded the file successfully: ${req.file.originalname}, but public access is denied!`,
    //     url: publicUrl,
    //   });
    // }

    // console.log("from post case file", req.file);
    const { case_id, paralegal_id } = req.body;
  
    const connection = await db._connect();
    if (!file || !case_id) {
      return next(new AppError("you need select a file or a case id", 400));
    }
    // fileName = `case-${case_id}-${Date.now()}` + fileName;
    const status = await connection.query(
      "INSERT INTO  iims_codebits_t_case_files" +
        " (file_name, paralegal_id, case_id, file_path, file_size, file_type )" +
        "VALUES(?,?,?,?,?,?)",
      [
        file.originalname,
        paralegal_id,
        case_id,
        fileName,
        file.size,
        file.mimetype,
      ]
    );
    res.status(200).send({
      message: "Uploaded the file successfully: " + req.file.originalname,
      url: publicUrl,
    });
  });

  blobStream.end(req.file.buffer);
});

exports.onLogin = catchAsync(async (req, res, next) => {
  const { email, password, remember_me } = req.body;
  if (!email || !password) {
    return next(new AppError("please sigin with email and password", 403));
  }
  const connection = await db._connect();
  const result = await connection.query(
    "SELECT status FROM iims_codebits_t_paralegals WHERE iims_codebits_t_paralegals.email = ?",
    [email]
  );
  console.log("result is", result);
  // console.log("the email is", email, password);
  if (!result || result === undefined || result === null || !result.length) {
    return next(
      new AppError(
        "No account matching provided email found please signup",
        403
      )
    );
  }
  if (result[0]["status"] !== 1) {
    return next(
      new AppError("please contact LASP to activate your account", 403)
    );
  }
  const payload = await lib._login(email, password, remember_me);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  res.status(200).send({ message: "OK", payload });
});

exports.getExecutedParalegalClients = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }
  const connection = await db._connect();

  const clients = await connection.query(
    "SELECT DISTINCT iims_law_client.name, iims_law_client.id as client_id FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 5)  ORDER BY iims_law_client.name ASC",
    [payload.paralegal_id]
  );
  res.status(200).send({ message: "OK", clients });
});

exports.getExecutedParalegalClientCases = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }
  const connection = await db._connect();
  const { client_id } = req.body;
  console.log("teh client id is", client_id);
  const cases = await connection.query(
    "SELECT iims_law_cases.title as case_title, iims_law_cases.id as case_id FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND (iims_law_client.id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2) AND (iims_law_cases.case_stage = 'Closed') ORDER BY iims_law_cases.title ASC",
    [payload.paralegal_id, client_id]
  );
  res.status(200).send({ message: "OK", cases });
});

exports.getClientCaseDetails = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }

  const { case_id } = req.body;
  // console.log("case id is", case_id);

  const connection = await db._connect();

  const cases_details = await connection.query(
    "SELECT iims_law_client.name as client_name, iims_law_cases.title as case_title, iims_law_cases.summary as case_summary, iims_law_cases.type as case_type, iims_law_cases.incident_date as incident_date, iims_law_cases.ref_no as case_ref_no, iims_law_cases.intervention as case_intervention, iims_law_cases.outcome_intervention, iims_law_cases.expectation as case_expectation, iims_law_cases.expectation_l as case_expectation_l, iims_law_cases.pathway as case_pathway, iims_law_client.occupation as client_occupation, iims_law_client.phone as client_contact, iims_law_cases.case_stage as case_progress, iims_law_firms.name as firm_name FROM iims_law_cases INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id INNER JOIN iims_law_firms ON iims_law_firms.firm_id = iims_law_cases.f_id WHERE (iims_law_cases.id = ?)",
    [case_id]
  );
  res.status(200).send({ message: "OK", cases_details });
});

exports.getParalegalClients = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }
  const connection = await db._connect();
  const clients = await connection.query(
    "SELECT DISTINCT iims_law_client.name, iims_law_client.id as client_id FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2) AND (iims_law_cases.case_stage != 'Closed') ORDER BY iims_law_client.name ASC",
    [payload.paralegal_id]
  );
  res.status(200).send({ message: "OK", clients });
});

exports.getParalegalClientCases = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }
  const { client_id } = req.body;
  console.log("the client id is", client_id);
  const connection = await db._connect();
  const cases = await connection.query(
    "SELECT iims_law_cases.title as case_title, iims_law_cases.id as case_id FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND (iims_law_client.id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 5 OR iims_codebits_t_referrals.referral_status_id = 2 ) AND (iims_law_cases.case_stage != 'Closed') ORDER BY iims_law_cases.title ASC",
    [payload.paralegal_id, client_id]
  );
  res.status(200).send({ message: "OK", cases });
});

exports.getParalegalCases = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }
  const connection = await db._connect();
  const cases = await connection.query(
    "SELECT DISTINCT iims_law_client.name, iims_law_cases.id FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2) AND (iims_law_cases.case_stage != 'Closed') ORDER BY iims_law_client.name ASC",
    [payload.paralegal_id]
  );
  res.status(200).send({ message: "OK", cases });
});

exports.getParalegalCases = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }
  const connection = await db._connect();
  const cases = await connection.query(
    "SELECT DISTINCT iims_law_client.name, iims_law_cases.id FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2) AND (iims_law_cases.case_stage != 'Closed') ORDER BY iims_law_client.name ASC",
    [payload.paralegal_id]
  );
  res.status(200).send({ message: "OK", cases });
});

exports.getParalegalCaseDetails = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  const { case_id } = req.body;
  if (!case_id) {
    return next(new AppError("You need to provide a case ID", 400));
  }
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }

  const connection = await db._connect();
  const caseDetails = await connection.query(
    "SELECT iims_law_cases.title, iims_law_cases.type, iims_law_cases.summary, iims_law_cases.ref_no, iims_law_cases.intervention, iims_law_cases.outcome_intervention, iims_law_cases.expectation, iims_law_cases.expectation_l, iims_law_cases.action, iims_law_cases.reporting_date, iims_law_cases.incident_date, iims_law_client.name, iims_law_client.sex, iims_law_client.phone, iims_law_client.occupation, iims_law_client.language, iims_law_client.level, iims_law_client.disabilities, iims_law_zone.name AS district, iims_law_client.subcounty, iims_law_client.next_of_kin, iims_law_client.tel_nok, iims_law_client.home_address, iims_law_client.date_of_birth FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id INNER JOIN iims_law_zone ON iims_law_zone.zone_id = iims_law_client.district WHERE (iims_law_cases.id = ?) AND (iims_codebits_t_referrals.paralegal_id = ?)",
    [case_id, payload.paralegal_id]
  );
  // console.log("the case details are ", caseDetails);
  if (!caseDetails.length) {
    return next(new AppError("No details found for this case", 400));
  }
  res.status(200).send({ message: "OK", caseDetails });
});

exports.getParalegalCaseReferrals = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }
  // console.log("the paralegal is ",payload.paralegal_id)
  const connection = await db._connect();
  const referrals = await connection.query(
    "SELECT iims_codebits_t_referrals.referral_id, iims_codebits_t_referrals.referral_action_requested, iims_codebits_t_referrals.referral_datetime, iims_codebits_t_referrals.case_id, iims_law_cases.title, iims_law_cases.type, iims_law_cases.summary, iims_law_cases.incident_date, iims_law_client.name, iims_law_firms.name AS firm FROM iims_codebits_t_referrals INNER JOIN iims_law_cases ON iims_law_cases.id = iims_codebits_t_referrals.case_id  INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id  INNER JOIN iims_law_firms ON iims_law_firms.firm_id = iims_law_cases.f_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND (iims_codebits_t_referrals.referral_status_id = 1)",
    [payload.paralegal_id]
  );
  // console.log("pay",referrals)
  res.status(200).send({ message: "OK", referrals });
});

exports.acceptCaseReferral = catchAsync(async (req, res, next) => {
  const payload =
    (await lib._getIIMSParalegalAuthPayload(req, res)) ||
    (await lib._getAuthPayload(req, res));
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }
  const connection = await db._connect();
  const { referral_id, case_id } = req.body;
  console.log("the body", referral_id, case_id);
  let status = await connection.query(
    "SELECT COUNT(iims_codebits_t_referrals.referral_id) Count FROM iims_codebits_t_referrals WHERE (iims_codebits_t_referrals.case_id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2)",
    [case_id]
  );

  if (parseInt(status[0]["Count"]) >= 1) {
    const result = await connection.query(
      "UPDATE iims_codebits_t_referrals SET iims_codebits_t_referrals.referral_status_id = 4 WHERE (iims_codebits_t_referrals.referral_id = ?) AND (iims_codebits_t_referrals.paralegal_id = ?)",
      [referral_id, payload.paralegal_id]
    );
    res.status(410).send({
      message:
        "Operation Failed: The referral has been accepted by another paralegal.",
      result,
    });
  } else {
    // Accept a referral
    status = await connection.query(
      "UPDATE iims_codebits_t_referrals SET iims_codebits_t_referrals.referral_status_id = 2, iims_codebits_t_referrals.status_change_datetime = ? WHERE (iims_codebits_t_referrals.referral_id = ?) AND (iims_codebits_t_referrals.paralegal_id = ?) AND (iims_codebits_t_referrals.referral_status_id = 1)",
      [new Date(), referral_id, payload.paralegal_id]
    );

    await lib._updateCaseReferrals(case_id);
    res
      .status(200)
      .send({ message: "Operation Successful: Referral accepted", status });
  }
});

exports.declineCaseReferral = catchAsync(async (req, res, next) => {
  const payload =
    (await lib._getIIMSParalegalAuthPayload(req, res)) ||
    (await lib._getAuthPayload(req, res));
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }
  const connection = await db._connect();
  const { referral_id, reason } = req.body;
  const status = await connection.query(
    "UPDATE iims_codebits_t_referrals SET iims_codebits_t_referrals.referral_status_id = 3, iims_codebits_t_referrals.status_change_datetime = ?, iims_codebits_t_referrals.status_change_reason = ? WHERE (iims_codebits_t_referrals.referral_id = ?) AND (iims_codebits_t_referrals.paralegal_id = ?) AND (iims_codebits_t_referrals.referral_status_id != 2)",
    [new Date(), reason, referral_id, payload.paralegal_id]
  );
  res.status(200).send({ message: "OK", affectedRows: status.affectedRows });
});

exports.updateParalegalAccount = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }
  const {
    firstname,
    othername,
    surname,
    contact,
    gender,
    image,
    field_of_expertise,
    firm_id,
    subcounty_id,
    village,
    preferred_language_id,
    other_languages,
    date_of_birth,
    level_of_education,
    lc_1_chairperson_name,
    lc_1_chairperson_telephone,
    mosque_imam_name,
    mosque_imam_contact,
    mosque_committee_position,
  } = req.body;

  const fullname =
    (gender === "Male" ? "Mr. " : "Ms. ") +
    firstname +
    " " +
    surname +
    " " +
    othername;
  const connection = await db._connect();
  const status = await connection.query(
    "UPDATE iims_codebits_t_paralegals SET" +
      " iims_codebits_t_paralegals.firstname = ?," +
      " iims_codebits_t_paralegals.surname = ?," +
      " iims_codebits_t_paralegals.othername = ?," +
      " iims_codebits_t_paralegals.fullname = ?," +
      " iims_codebits_t_paralegals.contact = ?," +
      " iims_codebits_t_paralegals.gender = ?," +
      " iims_codebits_t_paralegals.image = ?," +
      " iims_codebits_t_paralegals.field_of_expertise = ?," +
      " iims_codebits_t_paralegals.firm_id = ?," +
      " iims_codebits_t_paralegals.subcounty_id = ?," +
      " iims_codebits_t_paralegals.village = ?," +
      " iims_codebits_t_paralegals.preferred_language_id = ?," +
      " iims_codebits_t_paralegals.other_languages = ?," +
      " iims_codebits_t_paralegals.date_of_birth = ?," +
      " iims_codebits_t_paralegals.level_of_education = ?," +
      " iims_codebits_t_paralegals.chairperson_lc_1_fullname = ?," +
      " iims_codebits_t_paralegals.chairperson_lc_1_contact = ?," +
      " iims_codebits_t_paralegals.mosque_imam_name = ?," +
      " iims_codebits_t_paralegals.mosque_imam_contact = ?," +
      " iims_codebits_t_paralegals.mosque_committee_position = ?" +
      " WHERE (iims_codebits_t_paralegals.paralegal_id = ?)",
    [
      firstname,
      surname,
      othername,
      fullname,
      contact,
      gender,
      image,
      field_of_expertise,
      firm_id,
      subcounty_id,
      village,
      preferred_language_id,
      other_languages,
      date_of_birth,
      level_of_education,
      lc_1_chairperson_name,
      lc_1_chairperson_telephone,
      mosque_imam_name,
      mosque_imam_contact,
      mosque_committee_position,
      payload.paralegal_id,
    ]
  );
  res.status(200).send({
    message: "Operation Successful",
    affectedRows: status.affectedRows,
  });
});

exports.changeParalegalAccountPassword = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }
  const connection = await db._connect();
  const { current_password, new_password } = req.body;

  const result = await connection.query(
    "SELECT iims_codebits_t_paralegals.hashed_password FROM iims_codebits_t_paralegals WHERE (iims_codebits_t_paralegals.paralegal_id = ?)",
    [payload.paralegal_id]
  );

  const passwordIsValid = bcrypt.compareSync(
    current_password,
    result[0]["hashed_password"]
  );

  if (!passwordIsValid) {
    return next(new AppError("passowords dont match", 400));
  }
  const status = await connection.query(
    "UPDATE iims_codebits_t_paralegals SET" +
      " iims_codebits_t_paralegals.password = ?," +
      " iims_codebits_t_paralegals.hashed_password = ?" +
      " WHERE (iims_codebits_t_paralegals.paralegal_id = ?)",
    [new_password, bcrypt.hashSync(new_password, 10), payload.paralegal_id]
  );

  res.status(200).send({
    message: "Operation Successful: Password updated",
    affectedRows: status.affectedRows,
  });
});

exports.getAccountRecoveryQuestion = catchAsync(async (req, res, next) => {
  // const payload = lib._getAuthPayload(req, res);
  // if (!payload) {
  //   return next(new AppError("you need to log in", 400));
  // }
  const connection = await db._connect();
  const { account_email_address } = req.body;
  // console.log("the email is", account_email_address);
  const result = await connection.query(
    "SELECT iims_codebits_t_paralegals.recovery_question FROM iims_codebits_t_paralegals WHERE (iims_codebits_t_paralegals.email = ?)",
    [account_email_address]
  );

  if (!result.length) {
    return next(
      new AppError("Operation Failed: Invalid account email address.", 400)
    );
  }

  res
    .status(200)
    .send({ message: "Ok", question: result[0]["recovery_question"] });
});

exports.verifyRecoveryQuestionAnswer = catchAsync(async (req, res, next) => {
  const connection = await db._connect();
  const { account_email_address, recovery_question, recovery_answer } =
    req.body;

  const result = await connection.query(
    "SELECT COUNT(iims_codebits_t_paralegals.recovery_question) AS Count, iims_codebits_t_paralegals.paralegal_id, iims_codebits_t_paralegals.firm_id FROM iims_codebits_t_paralegals WHERE (iims_codebits_t_paralegals.email = ?) AND (iims_codebits_t_paralegals.recovery_question = ?) AND (iims_codebits_t_paralegals.recovery_answer = ?)",
    [account_email_address, recovery_question, recovery_answer]
  );

  // console.log("result", result);

  if (result[0]["Count"] !== "1") {
    return next(new AppError("Operation Failed: Wrong answer.", 400));
  }
  const tokenPayload = await db._generateToken(
    result[0]["paralegal_id"],
    result[0]["firm_id"],
    "false"
  );
  res.status(200).send({
    message: "Operation Successful.",
    token: tokenPayload.token,
    exp: tokenPayload.exp,
  });
});

exports.sendEmail = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }

  const { email_address } = req.body;

  const status = await db._sendEmail(
    email_address,
    "It's Mark",
    "Testing the emailing function",
    "<b>Testing the emailing function</b>"
  );

  // console.log("status:", status);

  if (!status["accepted"]) {
    return next(new AppError("'Operation Failed: Email not sent", 400));
  }
  res
    .status(200)
    .send({ message: "Operation Successful: The email has been sent", status });
});

exports.allowNotifications = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }
  const connection = await db._connect();
  const { notifications_token } = req.body;

  const status = await connection.query(
    "UPDATE iims_codebits_t_paralegals SET" +
      "  iims_codebits_t_paralegals.notifications_token = ?" +
      "WHERE iims_codebits_t_paralegals.paralegal_id = ?",
    [notifications_token, payload.paralegal_id]
  );
  res.status(200).send({
    message: "Operation Successful: Notifications enabled",
    affectedRows: status.affectedRows,
  });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/case_files");
  },
  filename: function (req, file, cb) {
    // console.log("the file is", file);
    // console.log("the unique suffix is", req.body);

    let fileName = file.originalname;

    fileName = `${Date.now()}` + fileName;

    cb(null, fileName);
  },
});

const upload = multer({ storage: storage });
exports.uploadFile = upload.single("file");
exports.resetParalegalAccountPassword = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }
  const connection = await db._connect();
  const { new_password } = JSON.parse(request.body);

  const query =
    "UPDATE iims_codebits_t_paralegals SET" +
    " iims_codebits_t_paralegals.password = ?," +
    " iims_codebits_t_paralegals.hashed_password = ?" +
    " WHERE (iims_codebits_t_paralegals.paralegal_id = ?)";

  const results = await _queryRunnerInsertOrUpdateOrDelete(query, [
    new_password,
    bcrypt.hashSync(new_password, 10),
    payload.paralegal_id,
  ]);

  res.status(results.code).send({
    message:
      results.code === 200
        ? "Operation Successful: Password updated"
        : results.message,
    affectedRows: results.data.affectedRows,
  });
});
exports.postCaseFile = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }
  // console.log("from post case file", req.file);
  const { case_id, paralegal_id } = req.body;
  console.log("from body", req.body);
  const connection = await db._connect();
  let file = req.file;
  console.log("the file is", req.file);
  if (!file || !case_id) {
    return next(new AppError("you need select a file or a case id", 400));
  }
  // fileName = `case-${case_id}-${Date.now()}` + fileName;
  const status = await connection.query(
    "INSERT INTO  iims_codebits_t_case_files" +
      " (file_name, paralegal_id, case_id, file_path, file_size, file_type )" +
      "VALUES(?,?,?,?,?,?)",
    [
      file.originalname,
      paralegal_id,
      case_id,
      file.filename,
      file.size,
      file.mimetype,
    ]
  );
  res.status(200).send({
    message: "Operation Successful: file upload",
    affectedRows: status.affectedRows,
  });
});

exports.getCaseFiles = catchAsync(async (req, res, next) => {
  const payload =
    (await lib._getIIMSParalegalAuthPayload(req, res)) ||
    (await lib._getAuthPayload(req, res));
  console.log("from controller", payload);
  if (!payload || payload === null || payload === undefined) {
    return next(new AppError("you need to log in", 400));
  }

  const { case_id } = req.body;
  if (!case_id) {
    return next(new AppError("you need submit a case id", 400));
  }
  // console.log("the case id is", case_id);
  const connection = await db._connect();
  const caseFiles = await connection.query(
    "SELECT file_name,case_id" +
      " FROM iims_codebits_t_case_files WHERE (case_id = ?)",
    [case_id]
  );
  // console.log("the case files are", caseFiles);
  res.status(200).send({
    message: "Ok",
    files: caseFiles,
  });
});

exports.closeCase = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }

  const connection = await db._connect();

  const { case_id, reason, remarks } = req.body;
  if (!reason || !remarks || !case_id) {
    return next(
      new AppError("you need provide a reason and give remarks", 400)
    );
  }
  const status = await connection.query(
    "UPDATE iims_codebits_t_referrals SET iims_codebits_t_referrals.referral_status_id = 5, iims_codebits_t_referrals.status_change_datetime = ?, iims_codebits_t_referrals.remarks = ?, iims_codebits_t_referrals.status_change_reason = ? WHERE (iims_codebits_t_referrals.case_id = ?) AND (iims_codebits_t_referrals.paralegal_id = ?)  AND (iims_codebits_t_referrals.referral_status_id != 5) ",
    [new Date(), remarks, reason, case_id, payload.paralegal_id]
  );
  res.status(200).send({
    message: "Operation successful: Case closed",
    affectedRows: status.affectedRows,
  });
});

// exports.referCaseToParalegal = catchAsync(async (req, res, next) => {
//   const payload = lib._getAuthPayload(req, res);
//   if (!payload) {
//     return next(new AppError("you need to log in", 400));
//   }

//   const { case_id, reason } = req.body;
//   if (!reason || !case_id) {
//     return next(
//       new AppError("You need to give reason as to why case is referred", 400)
//     );
//   }
//   const connection = await db._connect();
//   const status = await connection.query(
//     "INSERT INTO iims_codebits_t_referrals (case_id, paralegal_id, referral_action_requested)" +
//       "VALUES (?, ?, ?)",
//     [case_id, payload.paralegal_id, reason]
//   );
//   let response_message = "Operation Successful: Referral created ";

//   // Send email notification
//   if (paralegal_email) {
//     const email_status = await db._sendEmail(
//       // paralegal_email,
//       "kajubimark2@gmail.com",
//       "Case Referral " + (client_name ? "For " + client_name : ""),
//       "Case Ttitle: " +
//         case_title +
//         " Case Summary: " +
//         case_summary +
//         " Message: " +
//         message,
//       "<h3>Dear " +
//         paralegal_fullname +
//         ",</h3> <p style='color: #494949;'>You have received a case referral from <b>" +
//         firm_details.name +
//         "</b> with the following details.</p><h4 style='margin-bottom: 0px;'>Case Title </h4><p style='margin-top: 3px; font-weight: 700; color: #494949;'>" +
//         case_title +
//         "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Case Summary </h4><p style='margin-top: 3px; color: #494949;'>" +
//         case_summary +
//         "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Requested Action </h4><p style='margin-top: 3px; color: #494949;'>" +
//         message +
//         "</p>"
//     );

//     if (email_status["accepted"].length) {
//       response_message += "and an email sent to the Paralegal";
//     } else {
//       response_message += "but the email was not sent.";
//     }
//   }

//   res.status(201).send({
//     message: response_message,
//     affectedRows: status.affectedRows,
//     code: 201,
//   });
// });

exports.referCaseToParalegal = catchAsync(async (req, res, next) => {
  const payload =
    (await lib._getIIMSParalegalAuthPayload(req, res)) ||
    (await lib._getAuthPayload(req, res));
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }

  const {
    case_id,
    case_title,
    case_summary,
    client_name,
    paralegal_id,
    message,
  } = req.body;
  console.log(
    "the stuff is",
    case_id,
    case_title,
    case_summary,
    client_name,
    paralegal_id,
    message
  );
  if (!paralegal_id || !case_id) {
    return next(new AppError("You need to give a referal paralegal", 400));
  }
  const connection = await db._connect();
  const referingParalegal = await lib._getParalegalDetailsbyId(
    payload.paralegal_id
  );
  const paralegalDetails = await lib._getParalegalDetailsbyId(paralegal_id);
  const status = await connection.query(
    "INSERT INTO iims_codebits_t_referrals (case_id, paralegal_id, referral_action_requested, referred_by_paralegal_id)" +
      "VALUES (?, ?, ?, ?)",
    [case_id, paralegal_id, message, payload.paralegal_id]
  );
  let response_message = "Operation Successful: Referral created ";

  if (paralegalDetails.email) {
    const email_status = await db._sendEmail(
      paralegalDetails.email,
      // "kajubimark2@gmail.com",
      "Case Referral " + (client_name ? "For " + client_name : ""),
      "Case Ttitle: " +
        case_title +
        " Case Summary: " +
        case_summary +
        " Message: " +
        message,
      "<h3>Dear " +
        paralegalDetails.name +
        ",</h3> <p style='color: #494949;'>You have received a case referral from <b>" +
        referingParalegal.name +
        "</b> with the following details.</p><h4 style='margin-bottom: 0px;'>Case Title </h4><p style='margin-top: 3px; font-weight: 700; color: #494949;'>" +
        case_title +
        "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Case Summary </h4><p style='margin-top: 3px; color: #494949;'>" +
        case_summary +
        "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Requested Action </h4><p style='margin-top: 3px; color: #494949;'>" +
        message +
        "</p>"
    );
    if (!email_status || email_status === undefined || email_status === null) {
      response_message += "but the email was not sent.";
    } else if (email_status["accepted"].length) {
      response_message += "and an email sent to the Paralegal";
    }
  }
  res.status(201).send({
    message: response_message,
    affectedRows: status.affectedRows,
    code: 201,
  });
});

exports.referCaseToLasp = catchAsync(async (req, res, next) => {
  const payload =
    (await lib._getIIMSParalegalAuthPayload(req, res)) ||
    (await lib._getAuthPayload(req, res));
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }

  console.log("successfully reached here");
  const { case_id, case_title, case_summary, client_name, firm_id, message } =
    req.body;
  if (!firm_id || !case_id) {
    return next(new AppError("You need to give a referal lasp", 400));
  }
  const connection = await db._connect();
  const referingParalegal = await lib._getParalegalDetailsbyId(
    payload.paralegal_id
  );
  const firmDetails = await lib._getFirmDetailsByFirmId(firm_id);
  console.log(
    "the firm details are",
    case_id,
    case_title,
    case_summary,
    client_name,
    firm_id,
    message
  );
  const status = await connection.query(
    "INSERT INTO iims_codebits_t_referrals (case_id, firm_id, referral_action_requested, referred_by_paralegal_id)" +
      "VALUES (?, ?, ?, ?)",
    [case_id, firm_id, message, payload.paralegal_id]
  );
  let response_message = "Operation Successful: Referral created ";

  if (firmDetails.email) {
    const email_status = await db._sendEmail(
      firmDetails.email,
      // "kajubimark2@gmail.com",
      "Case Referral " + (client_name ? "For " + client_name : ""),
      "Case Ttitle: " +
        case_title +
        " Case Summary: " +
        case_summary +
        " Message: " +
        message,
      "<h3>Dear " +
        firmDetails.name +
        ",</h3> <p style='color: #494949;'>You have received a case referral from <b>" +
        referingParalegal.name +
        "</b> with the following details.</p><h4 style='margin-bottom: 0px;'>Case Title </h4><p style='margin-top: 3px; font-weight: 700; color: #494949;'>" +
        case_title +
        "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Case Summary </h4><p style='margin-top: 3px; color: #494949;'>" +
        case_summary +
        "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Requested Action </h4><p style='margin-top: 3px; color: #494949;'>" +
        message +
        "</p>"
    );
    if (!email_status || email_status === undefined || email_status === null) {
      response_message += "but the email was not sent.";
    } else if (email_status["accepted"].length) {
      response_message += "and an email sent to the Paralegal";
    }
  }
  res.status(201).send({
    message: response_message,
    affectedRows: status.affectedRows,
    code: 201,
  });
});

exports.getAllParalegals = catchAsync(async (req, res, next) => {
  const payload = lib._getAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("you need to log in", 400));
  }

  const connection = await db._connect();
  const paralegals = await connection.query(
    "SELECT paralegal_id,fullname" + " FROM iims_codebits_t_paralegals "
  );
  // console.log("the case files are", paralegals);
  res.status(200).send({
    message: "Ok",
    paralegals: paralegals,
  });
});
