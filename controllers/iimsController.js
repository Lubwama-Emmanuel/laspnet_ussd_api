const catchAsync = require("./../utils/catchAsync");
const AppError = require("./../utils/appError");
const db = require("./../utils/config");
const bcrypt = require("bcryptjs");
const lib = require("./../utils/lib");
const uuid = require("uuid-int");
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
  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
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
    const { case_id } = req.body;

  const connection = await db._connect();
  let file = req.file;

  if (!file || !case_id) {
    return next(new AppError("you need select a file or a case id", 400));
  }

  let status;
  if (
    payload.paralegal_id === "null" ||
    payload.paralegal_id === "" ||
    payload.paralegal_id === undefined ||
    payload.paralegal_id === null
  ) {
    status = await connection.query(
      "INSERT INTO  iims_codebits_t_case_files" +
        " (file_name, firm_id, case_id, file_path, file_size, file_type )" +
        "VALUES(?,?,?,?,?,?)",
      [
        file.originalname,
        payload.firm_id,
        case_id,
        fileName,
        Number(file.size) / 1000000,
        file.mimetype.split("/")[1],
      ]
    );
  } else {
    status = await connection.query(
      "INSERT INTO  iims_codebits_t_case_files" +
        " (file_name, paralegal_id, case_id, file_path, file_size, file_type )" +
        "VALUES(?,?,?,?,?,?)",
      [
        file.originalname,
        payload.paralegal_id,
        case_id,
        fileName,
        Number(file.size) / 1000000,
        file.mimetype.split("/")[1],
      ]
    );
  }


    res.status(200).send({
      message: "Uploaded the file successfully: " + req.file.originalname,
      url: publicUrl,
    });
  });

  blobStream.end(req.file.buffer);
});


exports.iims_createParalegalReferral = catchAsync(async (req, res, next) => {
  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  console.log("payload from create referrals", payload);
  // return

  const {
    case_id,
    case_title,
    case_summary,
    client_name,
    paralegal_info,
    message,
  } = req.body;

  const paralegal_info_array = paralegal_info.split(":");
  const paralegal_id = paralegal_info_array[0];
  const paralegal_email = paralegal_info_array[1];
  const paralegal_contact = paralegal_info_array[2];
  const paralegal_fullname = paralegal_info_array[3];

  console.log("paralegal_contact:", paralegal_contact);

  const firm_details = await lib._getFirmDetailsByFirmId(payload.firm_id);

  const connection = await db._connect();
  let status;
  let paralegalDetails;
  if (
    payload.paralegal_id === "null" ||
    payload.paralegal_id === "" ||
    payload.paralegal_id === undefined ||
    payload.paralegal_id === null
  ) {
    status = await connection.query(
      "INSERT INTO iims_codebits_t_referrals (case_id, paralegal_id, referral_action_requested, referred_by_firm_id)" +
        "VALUES (?, ?, ?,? )",
      [case_id, paralegal_id, message, payload.firm_id]
    );
  } else {
    paralegalDetails = await lib._getParalegalDetailsbyId(payload.paralegal_id);

    status = await connection.query(
      "INSERT INTO iims_codebits_t_referrals (case_id, paralegal_id, referral_action_requested, referred_by_paralegal_id)" +
        "VALUES (?, ?, ?,? )",
      [case_id, paralegal_id, message, payload.paralegal_id]
    );
  }

  let response_message = "Operation Successful: Referral created ";
  console.log("paralegal details", paralegalDetails);
  // Send email notification
  // console.log()
  const senderName =
    payload.paralegal_id === "null" ||
    payload.paralegal_id === "" ||
    payload.paralegal_id === undefined ||
    payload.paralegal_id === null
      ? firm_details.name
      : paralegalDetails.name;
  if (paralegal_email) {
    const email_status = await db._sendEmail(
      paralegal_email,
      // "kajubimark2@gmail.com",
      "Case Referral " + (client_name ? "For " + client_name : ""),
      "Case Ttitle: " +
        case_title +
        " Case Summary: " +
        case_summary +
        " Message: " +
        message,
      "<h3>Dear " +
        paralegal_fullname +
        ",</h3> <p style='color: #494949;'>You have received a case referral from <b>" +
        senderName +
        "</b> with the following details.</p><h4 style='margin-bottom: 0px;'>Case Title </h4><p style='margin-top: 3px; font-weight: 700; color: #494949;'>" +
        case_title +
        "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Case Summary </h4><p style='margin-top: 3px; color: #494949;'>" +
        case_summary +
        "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Requested Action </h4><p style='margin-top: 3px; color: #494949;'>" +
        message +
        "</p>"
    );

    console.log("the email status is", email_status);
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
exports.iims_createLapsReferral = catchAsync(async (req, res, next) => {
  const payload = await lib._getIIMSAuthPayload(req, res);
  // console.log("the payload from the function is ",payl)
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }

  // return

  const {
    case_id,
    case_title,
    case_summary,
    client_name,
    lasp_info,
    message,
  } = req.body;
  // console.log("the body is",req.body)
  const data = lasp_info.split(":");
  const lasp_id = data[0];
  const lasp_email = data[1];
  const lasp_contact = data[2];
  const lasp_name = data[3];

  const firm_details = await lib._getFirmDetailsByFirmId(payload.firm_id);
  console.log("the fetched data", firm_details);
  const connection = await db._connect();
  let status;
  let paralegalDetails;
  if (
    payload.paralegal_id === "null" ||
    payload.paralegal_id === "" ||
    payload.paralegal_id === undefined ||
    payload.paralegal_id === null
  ) {
    status = await connection.query(
      "INSERT INTO iims_codebits_t_referrals (case_id, firm_id, referral_action_requested, referred_by_firm_id)" +
        "VALUES (?, ?, ?,? )",
      [case_id, lasp_id, message, payload.firm_id]
    );
  } else {
    paralegalDetails = await lib._getParalegalDetailsbyId(payload.paralegal_id);

    status = await connection.query(
      "INSERT INTO iims_codebits_t_referrals (case_id, firm_id, referral_action_requested, referred_by_paralegal_id)" +
        "VALUES (?, ?, ?,? )",
      [case_id, lasp_id, message, payload.paralegal_id]
    );
  }

  let response_message = "Operation Successful: Referral created ";
  // console.log("paralegal details", paralegalDetails);
  // Send email notification
  // console.log()
  const senderName =
    payload.paralegal_id === "null" ||
    payload.paralegal_id === "" ||
    payload.paralegal_id === undefined ||
    payload.paralegal_id === null
      ? firm_details.name
      : paralegalDetails.name;
  if (lasp_email) {
    const email_status = await db._sendEmail(
      lasp_email,
      // "kajubimark2@gmail.com",
      "Case Referral " + (client_name ? "For " + client_name : ""),
      "Case Ttitle: " +
        case_title +
        " Case Summary: " +
        case_summary +
        " Message: " +
        message,
      "<h3>Dear " +
        lasp_name +
        ",</h3> <p style='color: #494949;'>You have received a case referral from <b>" +
        senderName +
        "</b> with the following details.</p><h4 style='margin-bottom: 0px;'>Case Title </h4><p style='margin-top: 3px; font-weight: 700; color: #494949;'>" +
        case_title +
        "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Case Summary </h4><p style='margin-top: 3px; color: #494949;'>" +
        case_summary +
        "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Requested Action </h4><p style='margin-top: 3px; color: #494949;'>" +
        message +
        "</p>"
    );

    console.log("the email status is", email_status);
    if (!email_status || email_status === undefined || email_status === null) {
      response_message += "but the email was not sent.";
    } else if (email_status["accepted"].length) {
      response_message += "and an email sent to the Legal Service Provider";
    }
  }

  res.status(201).send({
    message: response_message,
    affectedRows: status.affectedRows,
    code: 201,
  });
});

exports.iims_editReferral = catchAsync(async (req, res, next) => {
  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  const {
    case_title,
    case_summary,
    client_name,
    paralegal_info,
    message,
    paralegal_id,
    paralegal_email,
    paralegal_contact,
    paralegal_fullname,
    referral_id,
    previous_message,
    lasp_info,
    firm_id,
    firm_name,
  } = req.body;

  let paralegal_info_array = [];

  if (paralegal_info === "default" && lasp_info === "default") {
    paralegal_info_array = paralegal_info.split(":");
    // console.log('paralegal_id:', paralegal_info_array[0]);
    // console.log('paralegal_email:', paralegal_info_array[1]);
    // console.log('paralegal_contact:', paralegal_info_array[2]);
    // console.log('paralegal_fullname:', paralegal_info_array[3])
    const connection = await db._connect();
    let status;
    let receiverName;
    if (
      paralegal_id !== null &&
      paralegal_id !== "" &&
      paralegal_id !== undefined
    ) {
      receiverName = paralegal_fullname;
      status = await connection.query(
        "UPDATE iims_codebits_t_referrals" +
          " INNER JOIN iims_law_cases ON iims_law_cases.id = iims_codebits_t_referrals.case_id" +
          " SET iims_codebits_t_referrals.paralegal_id = ?," +
          "     iims_codebits_t_referrals.referral_action_requested = ?" +
          " WHERE ((iims_codebits_t_referrals.referral_id = ?) AND" +
          "        (iims_codebits_t_referrals.referral_status_id = 1))",
        [paralegal_id, message, referral_id]
      );
    } else {
      receiverName = firm_name;
      status = await connection.query(
        "UPDATE iims_codebits_t_referrals" +
          " INNER JOIN iims_law_cases ON iims_law_cases.id = iims_codebits_t_referrals.case_id" +
          " SET iims_codebits_t_referrals.firm_id = ?," +
          "     iims_codebits_t_referrals.referral_action_requested = ?" +
          " WHERE ((iims_codebits_t_referrals.referral_id = ?) AND" +
          "        (iims_codebits_t_referrals.referral_status_id = 1))",
        [firm_id, message, referral_id]
      );
    }

    if (status.affectedRows === 1) {
      // Check if the data has changed
      if (previous_message === message) {
        res.status(200).send({
          message: "Operation Successful.",
          affectedRows: status.affectedRows,
          code: 200,
        });
      } else {
        // Push a firebase notification, email, sms Informing the previous paralegal... future update

        // Push a firebase notification/email/sms informing the new paralegal.
        let response_message = "Operation Successful: Referral updated ";
        const firm_details = await lib._getFirmDetailsByFirmId(payload.firm_id);

        if (paralegal_email) {
          const email_status = await db._sendEmail(
            paralegal_email,
            "Case Referral " + (client_name ? "For " + client_name : ""),
            "Case Ttitle: " +
              case_title +
              " Case Summary: " +
              case_summary +
              " Message: " +
              message,
            "<h3>Dear " +
              receiverName +
              ",</h3> <p>Case referral has been changed <b>" +
              "</b> with the following details.</p><h4 style='margin-bottom: 0px;'>Case Title </h4><p style='margin-top: 3px; font-weight: 700;'>" +
              case_title +
              "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Case Summary </h4><p style='margin-top: 3px;'>" +
              case_summary +
              "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Requested Action </h4><p style='margin-top: 3px;'>" +
              message +
              "</p>"
          );

          if (
            !email_status ||
            email_status === undefined ||
            email_status === null
          ) {
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
      }
    }
  } else if (paralegal_info === "default" && lasp_info !== "default") {
    let lasp_info_array = [];
    lasp_info_array = lasp_info.split(":");
    const lasp_id = lasp_info_array[0];
    const lasp_email = lasp_info_array[1];
    const lasp_contact = lasp_info_array[2];
    const lasp_name = lasp_info_array[3];
    const connection = await db._connect();

    const status = await connection.query(
      "UPDATE iims_codebits_t_referrals" +
        " INNER JOIN iims_law_cases ON iims_law_cases.id = iims_codebits_t_referrals.case_id" +
        " SET iims_codebits_t_referrals.firm_id = ?," +
        "iims_codebits_t_referrals.paralegal_id = ?," +
        "     iims_codebits_t_referrals.referral_action_requested = ?" +
        " WHERE ((iims_codebits_t_referrals.referral_id = ?) AND" +
        "        (iims_codebits_t_referrals.referral_status_id = 1))",
      [lasp_id, null, message, referral_id]
    );

    let response_message = "Operation Successful: Referral updated ";
    const firm_details = await lib._getFirmDetailsByFirmId(payload.firm_id);

    if (lasp_email) {
      const email_status = await db._sendEmail(
        lasp_email,
        "Case Referral " + (client_name ? "For " + client_name : ""),
        "Case Ttitle: " +
          case_title +
          " Case Summary: " +
          case_summary +
          " Message: " +
          message,
        "<h3>Dear " +
          lasp_name +
          ",</h3> <p>You've have received a case referral <b>" +
          "</b> with the following details.</p><h4 style='margin-bottom: 0px;'>Case Title </h4><p style='margin-top: 3px; font-weight: 700;'>" +
          case_title +
          "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Case Summary </h4><p style='margin-top: 3px;'>" +
          case_summary +
          "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Requested Action </h4><p style='margin-top: 3px;'>" +
          message +
          "</p>"
      );

      if (
        !email_status ||
        email_status === undefined ||
        email_status === null
      ) {
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
  } else if (paralegal_info !== "default" && lasp_info === "default") {
    paralegal_info_array = paralegal_info.split(":");
    const paralegal_id = paralegal_info_array[0];
    const paralegal_email = paralegal_info_array[1];
    const paralegal_contact = paralegal_info_array[2];
    const paralegal_fullname = paralegal_info_array[3];

    const connection = await db._connect();

    const status = await connection.query(
      "UPDATE iims_codebits_t_referrals" +
        " INNER JOIN iims_law_cases ON iims_law_cases.id = iims_codebits_t_referrals.case_id" +
        " SET iims_codebits_t_referrals.paralegal_id = ?," +
        "iims_codebits_t_referrals.firm_id = ?," +
        "     iims_codebits_t_referrals.referral_action_requested = ?" +
        " WHERE ((iims_codebits_t_referrals.referral_id = ?) AND" +
        "        (iims_codebits_t_referrals.referral_status_id = 1))",
      [paralegal_id, null, message, referral_id]
    );
    let response_message = "Operation Successful: Referral updated ";
    const firm_details = await lib._getFirmDetailsByFirmId(payload.firm_id);

    if (paralegal_email) {
      const email_status = await db._sendEmail(
        paralegal_email,
        "Case Referral " + (client_name ? "For " + client_name : ""),
        "Case Ttitle: " +
          case_title +
          " Case Summary: " +
          case_summary +
          " Message: " +
          message,
        "<h3>Dear " +
          paralegal_fullname +
          ",</h3> <p>You've have received a case referral<b>" +
          "</b> with the following details.</p><h4 style='margin-bottom: 0px;'>Case Title </h4><p style='margin-top: 3px; font-weight: 700;'>" +
          case_title +
          "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Case Summary </h4><p style='margin-top: 3px;'>" +
          case_summary +
          "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Requested Action </h4><p style='margin-top: 3px;'>" +
          message +
          "</p>"
      );

      if (
        !email_status ||
        email_status === undefined ||
        email_status === null
      ) {
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
  } else if (paralegal_info !== "default" && lasp_info !== "default") {
    res.status(400).send({
      message: "please choose either a paralegal or lasp but  not both",
      code: 400,
    });
  }
});

exports.iims_deleteReferral = catchAsync(async (req, res, next) => {
  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  const { referral_id, firm_id } = payload;
  const connection = await db._connect();

  const status = await connection.query(
    "DELETE iims_codebits_t_referrals " +
      "FROM iims_codebits_t_referrals " +
      "INNER JOIN iims_law_cases ON iims_law_cases.id = iims_codebits_t_referrals.case_id " +
      "WHERE ((referral_id = ?) AND " +
      "       (iims_codebits_t_referrals.referral_status_id = 1) AND" +
      "       (iims_law_cases.f_id = ?))",
    [referral_id, firm_id]
  );

  if (!status.affectedRows === 1) {
    // Inform the paralegal about the referal being deleted.
    return next(
      new AppError(
        "Operation Failed: The Referral has already been deleted Or it's being handled by the Paralegal.",
        400
      )
    );
  }
  res.status(200).send({
    message: "Operation Successful: Referral deleted.",
    affectedRows: status.affectedRows,
  });
});

exports.iims_getReferralDetails = catchAsync(async (req, res, next) => {
  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }

  const { case_id, firm_id } = payload;
  const connection = await db._connect();
  const referrals = await connection.query(
    "SELECT iims_codebits_t_paralegals.fullname, iims_codebits_t_paralegals.image, iims_codebits_t_paralegals.contact, iims_codebits_t_paralegals.email, iims_codebits_t_referrals.referral_action_requested, DATE_FORMAT(iims_codebits_t_referrals.referral_datetime, '%a, %b %D,%Y %h:%i %p') AS referral_datetime, iims_codebits_rt_status.status_name, DATE_FORMAT(iims_codebits_t_referrals.status_change_datetime, '%a, %b %D,%Y %h:%i %p') AS status_change_datetime, iims_codebits_t_referrals.status_change_reason FROM iims_codebits_t_referrals INNER JOIN iims_codebits_t_paralegals ON iims_codebits_t_paralegals.paralegal_id = iims_codebits_t_referrals.paralegal_id INNER JOIN iims_codebits_rt_status ON iims_codebits_rt_status.status_id = iims_codebits_t_referrals.referral_status_id INNER JOIN iims_law_cases ON iims_law_cases.id = iims_codebits_t_referrals.case_id WHERE ((iims_codebits_t_referrals.case_id = ?) AND  (iims_law_cases.f_id = ?))",
    [case_id, firm_id]
  );
  res.status(200).send({ message: "OK", referrals, total: referrals.length });
});

exports.iims_viewParalegalReferrals = catchAsync(async (req, res, next) => {
  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  const { paralegal_id } = payload;
  const connection = await db._connect();

  const referrals = await connection.query(
    "SELECT iims_codebits_rt_status.status_name, iims_law_cases.title, iims_law_cases.summary, iims_law_client.name, DATE_FORMAT(iims_codebits_t_referrals.referral_datetime, '%a, %b %D,%Y %h:%i %p') as referral_datetime, iims_codebits_t_referrals.referral_action_requested, DATE_FORMAT(iims_codebits_t_referrals.status_change_datetime, '%a, %b %D,%Y %h:%i %p') as status_change_datetime, iims_codebits_t_referrals.status_change_reason FROM iims_codebits_t_referrals INNER JOIN iims_codebits_rt_status ON iims_codebits_rt_status.status_id = iims_codebits_t_referrals.referral_status_id INNER JOIN iims_law_cases ON iims_law_cases.id = iims_codebits_t_referrals.case_id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE iims_codebits_t_referrals.paralegal_id = ? ORDER BY iims_law_client.name ASC",
    [paralegal_id]
  );
  res.status(200).send({ message: "OK", referrals, total: referrals.length });
});

// exports.iims_registerParalegal = catchAsync(async (req, res, next) => {
//   const payload = await lib._getIIMSAuthPayload(req, res);
//   if (!payload) {
//     return next(new AppError("Invalid Credentials", 400));
//   }
//   const {
//     firstname,
//     surname,
//     othername,
//     contact,
//     gender,
//     email,
//     village,
//     subcounty_id,
//     preferred_language_id,
//     other_languages,
//     field_of_expertise,
//     image,
//     date_of_birth,
//     level_of_education,
//     lc_1_chairperson_name,
//     lc_1_chairperson_telephone,
//     mosque_imam_name,
//     mosque_imam_contact,
//     mosque_committee_position,
//   } = req.body;

//   const connection = await db._connect();

//   // Check if the account exists.
//   const result = await connection.query(
//     "SELECT paralegal_id FROM iims_codebits_t_paralegals WHERE iims_codebits_t_paralegals.email = ?",
//     [email]
//   );

//   if (result.length) {
//     return next(new AppError("operation failed account exists", 400));
//   }
//   const password = "defaultPassword123";
//   const hashedPassword = bcrypt.hashSync(password, 10);
//   // Register the paralegal
//   const fullname =
//     (gender === "Male" ? "Mr. " : "Ms. ") +
//     firstname +
//     " " +
//     surname +
//     " " +
//     othername;

//   const status = await connection.query(
//     "INSERT INTO iims_codebits_t_paralegals" +
//       "(firstname, surname, othername, email, contact, fullname, gender, image, field_of_expertise, firm_id, subcounty_id, village, preferred_language_id, other_languages, password, hashed_password, date_of_birth, chairperson_lc_1_fullname, chairperson_lc_1_contact, level_of_education, mosque_imam_name, mosque_imam_contact, mosque_committee_position)" +
//       "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
//     [
//       firstname,
//       surname,
//       othername,
//       email,
//       contact,
//       fullname,
//       gender,
//       image,
//       field_of_expertise,
//       payload.firm_id,
//       subcounty_id,
//       village,
//       preferred_language_id,
//       other_languages,
//       password,
//       hashedPassword,
//       date_of_birth,
//       lc_1_chairperson_name,
//       lc_1_chairperson_telephone,
//       level_of_education,
//       mosque_imam_name,
//       mosque_imam_contact,
//       mosque_committee_position,
//     ]
//   );
//   let response_message = "Operation Successful: account created ";

//   if (email) {
//     const email_status = await db._sendEmail(
//       email,

//       // "kajubimark2@gmail.com",
//       "Account Successfully Created",
//       "Paralegal Account Created",

//       "<h3>Dear " +
//       fullname +
//         ",</h3> <p style='color: #494949;'>You have account has been created. Please wait for activation"
//     );
//     if (email_status["accepted"].length) {
//       response_message += "and an email sent to the Paralegal";
//     } else {
//       response_message += "but the email was not sent.";
//     }
//   }

//   if (!status.affectedRows === 1) {
//     res.status(500).send({ message: "Operation Failed: Account not created." });
//     return next(new AppError("Operation Failed: Account not created.", 500));
//   }
//   res.status(201).send({ message: "Operation Successful: Account created." });
// });

exports.iims_deleteParalegal = catchAsync(async (req, res, next) => {
  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  const { paralegal_id, firm_id } = payload;
  const connection = await db._connect();

  const status = await connection.query(
    "DELETE FROM iims_codebits_t_paralegals WHERE iims_codebits_t_paralegals.paralegal_id = ? AND iims_codebits_t_paralegals.firm_id = ?",
    [paralegal_id, firm_id]
  );

  if (!status.affectedRows === 1) {
    return next(
      new AppError(
        "Operation Failed: The Paralegal has referrals attached to them",
        400
      )
    );
  }

  res.status(200).send({
    message: "Operation Successful: Paralegal Deleted.",
    affectedRows: status.affectedRows,
  });
});

exports.iims_fetchParalegalAccountDetails = catchAsync(
  async (req, res, next) => {
    const payload = await lib._getIIMSAuthPayload(req, res);
    if (!payload) {
      return next(new AppError("Invalid Credentials", 400));
    }
    const { paralegal_id, firm_id } = payload;

    const connection = await db._connect();

    const account = await connection.query(
      "SELECT iims_codebits_t_paralegals.firstname, iims_codebits_t_paralegals.surname, iims_codebits_t_paralegals.othername, iims_codebits_t_paralegals.email, iims_codebits_t_paralegals.contact, iims_codebits_t_paralegals.image, iims_codebits_t_paralegals.field_of_expertise, iims_codebits_t_paralegals.subcounty_id, CONCAT(iims_codebits_rt_subcounties.subcounty_name, ' - ', iims_codebits_rt_districts.district_name, ' District') AS subcounty_name, iims_codebits_t_paralegals.village, iims_codebits_t_paralegals.preferred_language_id, iims_codebits_rt_languages.language_name, iims_codebits_t_paralegals.other_languages, iims_codebits_t_paralegals.gender, iims_codebits_t_paralegals.preferred_language_id, DATE_FORMAT(iims_codebits_t_paralegals.date_of_birth, '%Y-%m-%d') AS date_of_birth, iims_codebits_t_paralegals.chairperson_lc_1_fullname, iims_codebits_t_paralegals.chairperson_lc_1_contact, iims_codebits_t_paralegals.level_of_education, iims_codebits_t_paralegals.mosque_imam_name, iims_codebits_t_paralegals.mosque_imam_contact, iims_codebits_t_paralegals.mosque_committee_position FROM iims_codebits_t_paralegals INNER JOIN iims_codebits_rt_languages ON iims_codebits_rt_languages.language_id = iims_codebits_t_paralegals.preferred_language_id INNER JOIN iims_codebits_rt_subcounties ON iims_codebits_rt_subcounties.subcounty_id = iims_codebits_t_paralegals.subcounty_id INNER JOIN iims_codebits_rt_districts ON iims_codebits_rt_districts.district_id = iims_codebits_rt_subcounties.district_id WHERE iims_codebits_t_paralegals.paralegal_id = ? AND iims_codebits_t_paralegals.firm_id = ?",
      [paralegal_id, firm_id]
    );
    res.status(200).send({ message: "OK", account: account[0] });
  }
);

exports.iims_editParalegal = catchAsync(async (req, res, next) => {
  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  const {
    firstname,
    surname,
    othername,
    contact,
    gender,
    email,
    village,
    subcounty_id,
    preferred_language_id,
    other_languages,
    field_of_expertise,
    image,
    date_of_birth,
    level_of_education,
    lc_1_chairperson_name,
    lc_1_chairperson_telephone,
    mosque_imam_name,
    mosque_imam_contact,
    mosque_committee_position,
  } = req.body;
  const connection = await db._connect();
  const fullname =
    (gender === "Male" ? "Mr. " : "Ms. ") +
    firstname +
    " " +
    surname +
    " " +
    othername;
  const status = await connection.query(
    "UPDATE iims_codebits_t_paralegals SET " +
      " firstname = ?," +
      " surname = ?," +
      " othername = ?," +
      " email = ?," +
      " contact = ?," +
      " fullname = ?," +
      " gender = ?," +
      " image = ?," +
      " field_of_expertise = ?," +
      " subcounty_id = ?," +
      " village = ?," +
      " preferred_language_id = ?," +
      " other_languages = ?," +
      " chairperson_lc_1_fullname = ?," +
      " chairperson_lc_1_contact = ?," +
      " level_of_education = ?," +
      " mosque_imam_name = ?," +
      " mosque_imam_contact = ?," +
      " mosque_committee_position = ?," +
      " date_of_birth = ?" +
      "WHERE iims_codebits_t_paralegals.paralegal_id = ? AND iims_codebits_t_paralegals.firm_id = ?",
    [
      firstname,
      surname,
      othername,
      email,
      contact,
      fullname,
      gender,
      image,
      field_of_expertise,
      subcounty_id,
      village,
      preferred_language_id,
      other_languages,
      lc_1_chairperson_name,
      lc_1_chairperson_telephone,
      level_of_education,
      mosque_imam_name,
      mosque_imam_contact,
      mosque_committee_position,
      date_of_birth,
      payload.paralegal_id,
      payload.firm_id,
    ]
  );

  if (status.affectedRows !== 1) {
    return next(
      new AppError("Operation Failed: Parelagal information not updated.", 400)
    );
  }
  res.status(200).send({
    message: "Operation Successful: Paralegal account updated.",
    affectedRows: status.affectedRows,
  });
});

exports.iims_viewParalegalReferrals = catchAsync(async (req, res, next) => {
  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  const connection = await db._connect();
  const { paralegal_id } = payload;

  const referrals = await connection.query(
    "SELECT iims_codebits_rt_status.status_name, iims_law_cases.title, iims_law_cases.summary, iims_law_client.name, DATE_FORMAT(iims_codebits_t_referrals.referral_datetime, '%a, %b %D,%Y %h:%i %p') as referral_datetime, iims_codebits_t_referrals.referral_action_requested, DATE_FORMAT(iims_codebits_t_referrals.status_change_datetime, '%a, %b %D,%Y %h:%i %p') as status_change_datetime, iims_codebits_t_referrals.status_change_reason FROM iims_codebits_t_referrals INNER JOIN iims_codebits_rt_status ON iims_codebits_rt_status.status_id = iims_codebits_t_referrals.referral_status_id INNER JOIN iims_law_cases ON iims_law_cases.id = iims_codebits_t_referrals.case_id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE iims_codebits_t_referrals.paralegal_id = ? ORDER BY iims_law_client.name ASC",
    [paralegal_id]
  );
  res.status(200).send({ message: "OK", referrals, total: referrals.length });
});

exports.iims_registerParalegal = catchAsync(async (req, res, next) => {
  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  const connection = await db._connect();
  const {
    firstname,
    surname,
    othername,
    contact,
    gender,
    email,
    village,
    subcounty_id,
    preferred_language_id,
    other_languages,
    field_of_expertise,
    image,
    date_of_birth,
    level_of_education,
    lc_1_chairperson_name,
    lc_1_chairperson_telephone,
    mosque_imam_name,
    mosque_imam_contact,
    mosque_committee_position,
  } = req.body;

  // Check if the account exists.
  const result = await connection.query(
    "SELECT paralegal_id FROM iims_codebits_t_paralegals WHERE iims_codebits_t_paralegals.email = ?",
    [email]
  );

  if (result.length) {
    return next(new AppError("Operation Failed: Account exists", 403));
  }
  const password = "defaultPassword123";
  const hashedPassword = bcrypt.hashSync(password, 10);
  // Register the paralegal
  const fullname =
    (gender === "Male" ? "Mr. " : "Ms. ") +
    firstname +
    " " +
    surname +
    " " +
    othername;

  const status = await connection.query(
    "INSERT INTO iims_codebits_t_paralegals" +
      "(firstname, surname, othername, email, contact, fullname, gender, image, field_of_expertise, firm_id, subcounty_id, village, preferred_language_id, other_languages, password, hashed_password, date_of_birth, chairperson_lc_1_fullname, chairperson_lc_1_contact, level_of_education, mosque_imam_name, mosque_imam_contact, mosque_committee_position,status)" +
      "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)",
    [
      firstname,
      surname,
      othername,
      email,
      contact,
      fullname,
      gender,
      image,
      field_of_expertise,
      payload.firm_id,
      subcounty_id,
      village,
      preferred_language_id,
      other_languages,
      password,
      hashedPassword,
      date_of_birth,
      lc_1_chairperson_name,
      lc_1_chairperson_telephone,
      level_of_education,
      mosque_imam_name,
      mosque_imam_contact,
      mosque_committee_position,
      1,
    ]
  );
  console.log("status id", status.insertId);
  const users = await connection.query(
    "INSERT INTO iims_users" +
      "(name,username,email,password,image,firm_id,phone,gender,user_group,paralegal_id,block)" +
      "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    [
      fullname,
      surname,
      email,
      hashedPassword,
      image,
      payload.firm_id,
      contact,
      gender,
      10,
      status.insertId,
      1,
    ]
  );

  if (status.affectedRows !== 1 || users.affectedRows !== 1) {
    return next(new AppError("Operation Failed: Account not created.", 500));
  }
  let response_message = "Operation Successful: account created ";

  if (email) {
    const email_status = await db._sendEmail(
      email,

      // "kajubimark2@gmail.com",
      "Account Successfully Created",
      "Paralegal Account Created",

      "<h3>Dear " +
        fullname +
        ",</h3> <p style='color: #494949;'>You have account has been created. Please wait for activation"
    );
    if (!email_status || email_status === undefined || email_status === null) {
      response_message += "but the email was not sent.";
    } else if (email_status["accepted"].length) {
      response_message += "and an email sent to the Paralegal";
    }
  }
  res.status(201).send({ message: "Operation Successful: Account created." });
});

exports.iims_deleteParalegal = catchAsync(async (req, res, next) => {
  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  const connection = await db._connect();
  const { paralegal_id, firm_id } = payload;

  const status = await connection.query(
    "DELETE FROM iims_codebits_t_paralegals WHERE iims_codebits_t_paralegals.paralegal_id = ? AND iims_codebits_t_paralegals.firm_id = ?",
    [paralegal_id, firm_id]
  );

  if (status.affectedRows === 1) {
    return next(
      new AppError(
        "Operation Failed: The Paralegal has referrals attached to them.",
        400
      )
    );
  }
  res.status(200).send({
    message: "Operation Successful: Paralegal Deleted.",
    affectedRows: status.affectedRows,
  });
});

exports.iims_fetchParalegalAccountDetails = catchAsync(
  async (req, res, next) => {
    const payload = await lib._getIIMSAuthPayload(req, res);
    if (!payload) {
      return next(new AppError("Invalid Credentials", 400));
    }
    const connection = await db._connect();
    const { paralegal_id, firm_id } = payload;

    const account = await connection.query(
      "SELECT iims_codebits_t_paralegals.firstname, iims_codebits_t_paralegals.surname, iims_codebits_t_paralegals.othername, iims_codebits_t_paralegals.email, iims_codebits_t_paralegals.contact, iims_codebits_t_paralegals.image, iims_codebits_t_paralegals.field_of_expertise, iims_codebits_t_paralegals.subcounty_id, CONCAT(iims_codebits_rt_subcounties.subcounty_name, ' - ', iims_codebits_rt_districts.district_name, ' District') AS subcounty_name, iims_codebits_t_paralegals.village, iims_codebits_t_paralegals.preferred_language_id, iims_codebits_rt_languages.language_name, iims_codebits_t_paralegals.other_languages, iims_codebits_t_paralegals.gender, iims_codebits_t_paralegals.preferred_language_id, DATE_FORMAT(iims_codebits_t_paralegals.date_of_birth, '%Y-%m-%d') AS date_of_birth, iims_codebits_t_paralegals.chairperson_lc_1_fullname, iims_codebits_t_paralegals.chairperson_lc_1_contact, iims_codebits_t_paralegals.level_of_education, iims_codebits_t_paralegals.mosque_imam_name, iims_codebits_t_paralegals.mosque_imam_contact, iims_codebits_t_paralegals.mosque_committee_position FROM iims_codebits_t_paralegals INNER JOIN iims_codebits_rt_languages ON iims_codebits_rt_languages.language_id = iims_codebits_t_paralegals.preferred_language_id INNER JOIN iims_codebits_rt_subcounties ON iims_codebits_rt_subcounties.subcounty_id = iims_codebits_t_paralegals.subcounty_id INNER JOIN iims_codebits_rt_districts ON iims_codebits_rt_districts.district_id = iims_codebits_rt_subcounties.district_id WHERE iims_codebits_t_paralegals.paralegal_id = ? AND iims_codebits_t_paralegals.firm_id = ?",
      [paralegal_id, firm_id]
    );
    res.status(200).send({ message: "OK", account: account[0] });
  }
);

exports.iims_editParalegal = catchAsync(async (req, res, next) => {
  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  const connection = await db._connect();
  const {
    firstname,
    surname,
    othername,
    contact,
    gender,
    email,
    village,
    subcounty_id,
    preferred_language_id,
    other_languages,
    field_of_expertise,
    image,
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
  const status = await connection.query(
    "UPDATE iims_codebits_t_paralegals SET " +
      " firstname = ?," +
      " surname = ?," +
      " othername = ?," +
      " email = ?," +
      " contact = ?," +
      " fullname = ?," +
      " gender = ?," +
      " image = ?," +
      " field_of_expertise = ?," +
      " subcounty_id = ?," +
      " village = ?," +
      " preferred_language_id = ?," +
      " other_languages = ?," +
      " chairperson_lc_1_fullname = ?," +
      " chairperson_lc_1_contact = ?," +
      " level_of_education = ?," +
      " mosque_imam_name = ?," +
      " mosque_imam_contact = ?," +
      " mosque_committee_position = ?," +
      " date_of_birth = ?" +
      "WHERE iims_codebits_t_paralegals.paralegal_id = ? AND iims_codebits_t_paralegals.firm_id = ?",
    [
      firstname,
      surname,
      othername,
      email,
      contact,
      fullname,
      gender,
      image,
      field_of_expertise,
      subcounty_id,
      village,
      preferred_language_id,
      other_languages,
      lc_1_chairperson_name,
      lc_1_chairperson_telephone,
      level_of_education,
      mosque_imam_name,
      mosque_imam_contact,
      mosque_committee_position,
      date_of_birth,
      payload.paralegal_id,
      payload.firm_id,
    ]
  );

  if (status.affectedRows === 1) {
    return next(
      new AppError("Operation Failed: Parelagal information not updated.", 500)
    );
  }
  res.status(200).send({
    message: "Operation Successful: Paralegal account updated.",
    affectedRows: status.affectedRows,
  });
});

exports.reportCase = catchAsync(async (req, res, next) => {
  const {
    victimName,
    caseTitle,
    region,
    contact,
    dateOfIncident,
    reportingDate,
    caseType,
    summary,
    lasp,
    referralPathway,
    previousIntervention,
    previousInterventionOutcome,
    clientExpectation,
    lawyerExpectaion,
  } = req.body;
  if (
    !victimName ||
    !caseTitle ||
    !region ||
    !contact ||
    !dateOfIncident ||
    !reportingDate ||
    !caseType ||
    !summary ||
    !lasp ||
    !referralPathway ||
    !previousIntervention ||
    !previousInterventionOutcome ||
    !clientExpectation ||
    !lawyerExpectaion
  ) {
    return next(new AppError("please fill out all the required fields"));
  }
  const connection = await db._connect();
  const id = uuid(500).uuid();
  console.log("the id is", id);
  const status = await connection.query(
    "INSERT INTO  iims_law_cases" +
      "(title,summary,incident_date,reporting_date,intervention,expectation,expectation_l,outcome_intervention,f_id,pathway,location,type,id)" +
      " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      caseTitle,
      summary,
      dateOfIncident,
      reportingDate,
      previousIntervention,
      clientExpectation,
      lawyerExpectaion,
      previousInterventionOutcome,
      lasp,
      referralPathway,
      region,
      caseType,
      id,
    ]
  );
  const firm_details = await lib._getFirmDetailsByFirmId(lasp);
  let response_message = "Operation Successful: Case recorded ";
  // console.log("paralegal details", paralegalDetails);
  // Send email notification
  // console.log()

  if (firm_details.email) {
    const email_status = await db._sendEmail(
      firm_details.email,
      // "kajubimark2@gmail.com",
      "Reporting Case  " + (caseTitle ? "For " + victimName : ""),
      "Case Ttitle: " +
        caseTitle +
        " Case Summary: " +
        summary +
        " Message: " +
        "this case has been reported from the paralegal referral pathway mobile application please complete filling the details within the iims",
      "<h3>Dear " +
        firm_details.name +
        ",</h3> <p style='color: #494949;'>A case has been reported from <b>" +
        "paralegal mobile application by Laspnet" +
        "</b> with the following details.</p><h4 style='margin-bottom: 0px;'>Case Title </h4><p style='margin-top: 3px; font-weight: 700; color: #494949;'>" +
        caseTitle +
        "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Case Summary </h4><p style='margin-top: 3px; color: #494949;'>" +
        summary +
        "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Requested Action </h4><p style='margin-top: 3px; color: #494949;'>" +
        "this case has been reported from the paralegal referral pathway mobile application please complete filling the details within the iims" +
        "</p>"
    );

    console.log("the email status is", email_status);
    if (!email_status || email_status === undefined || email_status === null) {
      response_message += "but the email was not sent.";
    } else if (email_status["accepted"].length) {
      response_message += "and an email sent to the Legal Service Provider";
    }
  }

  if (status.affectedRows == !1) {
    return next(new AppError("Operation Failed: case not recorded", 500));
  }
  res.status(200).send({
    message: response_message,
    affectedRows: status.affectedRows,
  });
});

exports.activateParalegalAccount = catchAsync(async (req, res, next) => {
  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  const { paralegal_id } = req.query;
  if (!paralegal_id) {
    return next(
      new AppError("Operation Failed: Please submit paralegal id", 400)
    );
  }
  const connection = await db._connect();
  const status = await connection.query(
    "UPDATE iims_codebits_t_paralegals SET status = ? WHERE paralegal_id = ? AND firm_id = ? ",
    [1, paralegal_id, payload.firm_id]
  );
  const paralegalDetails = await lib._getParalegalDetailsbyId(paralegal_id);
  // console.log("the paralegal details are",paralegalDetails)
  // return
  const users = await connection.query(
    "UPDATE iims_users SET block = ? WHERE paralegal_id = ? AND firm_id = ? ",
    [0, paralegal_id, payload.firm_id]
  );
  if (status.affectedRows !== 1 || users.affectedRows !== 1) {
    return next(
      new AppError("Operation Failed: Parelagal account not activated.", 400)
    );
  }
  let response_message = "Operation Successful: account activated ";

  if (paralegalDetails.email) {
    const email_status = await db._sendEmail(
      paralegalDetails.email,
      // "kajubimark2@gmail.com",
      "Account Successfully Activated",
      "Your account has successfully been activated",
      "<h3>Dear " +
        paralegalDetails.name +
        ",</h3> <p style='color: #494949;'>Your account as a paralegal has been activated you can now log into the mobile application  or the iims"
    );
    if (!email_status || email_status === undefined || email_status === null) {
      response_message += "but the email was not sent.";
    } else if (email_status["accepted"].length) {
      response_message += "and an email sent to the Paralegal";
    }
  }
  res.status(200).send({
    message: "Operation Successful: Paralegal account activated.",
    response: response_message,
  });
});

exports.deactivateParalegalAccount = catchAsync(async (req, res, next) => {
  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  const { paralegal_id } = req.query;
  if (!paralegal_id) {
    return next(
      new AppError("Operation Failed: Please submit paralegal id", 400)
    );
  }
  const connection = await db._connect();
  const status = await connection.query(
    "UPDATE iims_codebits_t_paralegals SET status = ? WHERE paralegal_id = ? AND firm_id = ? ",
    [2, paralegal_id, payload.firm_id]
  );
  const users = await connection.query(
    "UPDATE iims_users SET block = ? WHERE paralegal_id = ? AND firm_id = ? ",
    [1, paralegal_id, payload.firm_id]
  );
  if (status.affectedRows !== 1 || users.affectedRows !== 1) {
    return next(
      new AppError("Operation Failed: Parelagal account not revoked.", 400)
    );
  }
  let response_message = "Operation Successful: account revoked ";
  const paralegalDetails = await lib._getParalegalDetailsbyId(paralegal_id);

  if (paralegalDetails.email) {
    const email_status = await db._sendEmail(
      paralegalDetails.email,
      // "kajubimark2@gmail.com",
      "Account Revoked",
      "Your account has  been revoked",

      "<h3>Dear " +
        paralegalDetails.name +
        ",</h3> <p style='color: #494949;'>You have account as a paralegal has been revoked please contact your lasp for more information"
    );
    if (!email_status || email_status === undefined || email_status === null) {
      response_message += "but the email was not sent.";
    } else if (email_status["accepted"].length) {
      response_message += "and an email sent to the Paralegal";
    }
  }
  res.status(200).send({
    message: "Operation Successful: Paralegal account revoked.",
    response: response_message,
  });
});

exports.getCaseFiles = catchAsync(async (req, res, next) => {
  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  const { case_id } = req.query;
  if (!case_id) {
    return next(new AppError("you need submit a case id", 400));
  }
  console.log("the case id is nigga", case_id);
  const connection = await db._connect();
  const caseFiles = await connection.query(
    "SELECT file_name,file_type,file_size,file_path" +
      " FROM iims_codebits_t_case_files WHERE (case_id = ?)",
    [case_id]
  );
  // console.log("the case files are", caseFiles);
  res.status(200).send({
    message: "Ok",
    files: caseFiles,
  });
});

exports.acceptCaseReferal = catchAsync(async (req, res, next) => {
  // console.log("the stuff from query", req.query);

  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  // console.log("the body is ", req.body);
  if (
    payload.paralegal_id === "null" ||
    payload.paralegal_id === "" ||
    payload.paralegal_id === undefined ||
    payload.paralegal_id === null
  ) {
    const connection = await db._connect();
    const { referral_id, case_id } = req.query;
    // console.log("the body", referral_id, case_id);
    let status = await connection.query(
      "SELECT COUNT(iims_codebits_t_referrals.referral_id) Count FROM iims_codebits_t_referrals WHERE (iims_codebits_t_referrals.case_id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2)",
      [case_id]
    );
    if (parseInt(status[0]["Count"]) >= 1) {
      const result = await connection.query(
        "UPDATE iims_codebits_t_referrals SET iims_codebits_t_referrals.referral_status_id = 4 WHERE (iims_codebits_t_referrals.referral_id = ?) AND (iims_codebits_t_referrals.firm_id = ?)",
        [referral_id, payload.firm_id]
      );
      res.status(410).send({
        message:
          "Operation Failed: The referral has been accepted by another paralegal.",
        result,
      });
    } else {
      // Accept a referral
      status = await connection.query(
        "UPDATE iims_codebits_t_referrals SET iims_codebits_t_referrals.referral_status_id = 2, iims_codebits_t_referrals.status_change_datetime = ? WHERE (iims_codebits_t_referrals.referral_id = ?) AND (iims_codebits_t_referrals.firm_id = ?) AND (iims_codebits_t_referrals.referral_status_id = 1)",
        [new Date(), referral_id, payload.firm_id]
      );

      await lib._updateCaseReferrals(case_id);
      res
        .status(200)
        .send({ message: "Operation Successful: Referral accepted", status });
    }
  } else {
    const connection = await db._connect();
    const { referral_id, case_id } = req.query;
    // console.log("the body", referral_id, case_id);
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
          "Operation Failed: The referral has been accepted by another partner.",
        result,
      });
    } else {
      // Accept a referral by paralegal
      status = await connection.query(
        "UPDATE iims_codebits_t_referrals SET iims_codebits_t_referrals.referral_status_id = 2, iims_codebits_t_referrals.status_change_datetime = ? WHERE (iims_codebits_t_referrals.referral_id = ?) AND (iims_codebits_t_referrals.paralegal_id = ?) AND (iims_codebits_t_referrals.referral_status_id = 1)",
        [new Date(), referral_id, payload.paralegal_id]
      );

      await lib._updateCaseReferrals(case_id);
      res
        .status(200)
        .send({ message: "Operation Successful: Referral accepted", status });
    }
  }
});
exports.closeCase = catchAsync(async (req, res, next) => {
  // console.log("the stuff from query", req.query);

  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  console.log("the body is", req.body);

  const connection = await db._connect();

  const { referral_id, reason } = req.body;
  if (!reason || !referral_id) {
    return next(
      new AppError("you need provide a reason and give remarks", 400)
    );
  }
  const status = await connection.query(
    "UPDATE iims_codebits_t_referrals SET iims_codebits_t_referrals.referral_status_id = 5, iims_codebits_t_referrals.status_change_datetime = ?,  iims_codebits_t_referrals.status_change_reason = ? WHERE (iims_codebits_t_referrals.referral_id = ?)   AND (iims_codebits_t_referrals.referral_status_id != 5) ",
    [new Date(), reason, referral_id]
  );
  res.status(200).send({
    message: "Operation successful: Case closed",
    affectedRows: status.affectedRows,
  });
});

exports.declineCaseReferral = catchAsync(async (req, res, next) => {
  // console.log("the stuff from query", req.query);

  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  const connection = await db._connect();
  console.log("from body", req.body);

  const { referral_id, reason } = req.body;
  let status;
  if (
    payload.paralegal_id === "null" ||
    payload.paralegal_id === "" ||
    payload.paralegal_id === undefined ||
    payload.paralegal_id === null
  ) {
    status = await connection.query(
      "UPDATE iims_codebits_t_referrals SET iims_codebits_t_referrals.referral_status_id = 3, iims_codebits_t_referrals.status_change_datetime = ?, iims_codebits_t_referrals.status_change_reason = ? WHERE (iims_codebits_t_referrals.referral_id = ?) AND (iims_codebits_t_referrals.firm_id = ?) AND (iims_codebits_t_referrals.referral_status_id != 2)",
      [new Date(), reason, referral_id, payload.firm_id]
    );
  } else {
    status = await connection.query(
      "UPDATE iims_codebits_t_referrals SET iims_codebits_t_referrals.referral_status_id = 3, iims_codebits_t_referrals.status_change_datetime = ?, iims_codebits_t_referrals.status_change_reason = ? WHERE (iims_codebits_t_referrals.referral_id = ?) AND (iims_codebits_t_referrals.paralegal_id = ?) AND (iims_codebits_t_referrals.referral_status_id != 2)",
      [new Date(), reason, referral_id, payload.paralegal_id]
    );
  }

  res
    .status(200)
    .send({ message: "referral declined", affectedRows: status.affectedRows });
});
exports.postCaseFile = catchAsync(async (req, res, next) => {
  // console.log("the stuff from query", req.query);

  const payload = await lib._getIIMSAuthPayload(req, res);
  if (!payload) {
    return next(new AppError("Invalid Credentials", 400));
  }
  const { case_id } = req.body;

  const connection = await db._connect();
  let file = req.file;

  if (!file || !case_id) {
    return next(new AppError("you need select a file or a case id", 400));
  }

  let status;
  if (
    payload.paralegal_id === "null" ||
    payload.paralegal_id === "" ||
    payload.paralegal_id === undefined ||
    payload.paralegal_id === null
  ) {
    status = await connection.query(
      "INSERT INTO  iims_codebits_t_case_files" +
        " (file_name, firm_id, case_id, file_path, file_size, file_type )" +
        "VALUES(?,?,?,?,?,?)",
      [
        file.originalname,
        payload.firm_id,
        case_id,
        file.filename,
        Number(file.size) / 1000000,
        file.mimetype.split("/")[1],
      ]
    );
  } else {
    status = await connection.query(
      "INSERT INTO  iims_codebits_t_case_files" +
        " (file_name, paralegal_id, case_id, file_path, file_size, file_type )" +
        "VALUES(?,?,?,?,?,?)",
      [
        file.originalname,
        payload.paralegal_id,
        case_id,
        file.filename,
        Number(file.size) / 1000000,
        file.mimetype.split("/")[1],
      ]
    );
  }

  res.status(200).send({
    message: "Operation Successful: file upload",
    affectedRows: status.affectedRows,
  });
});

// });
