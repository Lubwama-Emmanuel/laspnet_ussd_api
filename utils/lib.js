// import { _connect, _verifyToken, _generateToken } from "./config";
const config = require("./config");

const bcrypt = require("bcryptjs");

exports._getAuthPayload = (request, response) => {
  const authHeader = request.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  let payload;
  console.log("successfully reached here")
  if (token === undefined) {
    response.status(403).send({ message: "Token is missing" });
    console.log("the token is from first if", token);
  } else {
    payload = config._verifyToken(token);
    console.log("from else is", payload);

    if (payload === undefined) {
      response.status(401).send({ message: "Token is invalid" });
      console.log("the token is", token);
    }
  }
  console.log("the returned payload is", payload);

  return payload;
};

exports._getIIMSAuthPayload = async (request, response) => {
  let payload = request.query;
  console.log("the payload is", payload);

  if (
    payload === undefined ||
    payload.session_id === "undefined" ||
    payload.firm_id === "undefined"
  ) {
    response.status(403).send({ message: "Session is missing" });
  } else {
    const connection = await config._connect();
    const status = await connection.query(
      "SELECT COUNT(iims_session.session_id) AS Count FROM iims_session WHERE iims_session.session_id = ? LIMIT 1",
      [payload.session_id]
    );
    console.log("the status is", status);
    if (parseInt(status[0]["Count"]) === 0) {
      payload = null;
    }
  }

  return payload;
};
exports._getIIMSParalegalAuthPayload = async (request, response) => {
  let payload = request.query;
  console.log("the payload is", payload);

  if (
    payload === undefined ||
    payload.session_id === "undefined" ||
    payload.firm_id === "undefined" ||
    payload.paralegal_id === "undefined"
  ) {
    response.status(403).send({ message: "Session is missing" });
  } else {
    const connection = await config._connect();
    const status = await connection.query(
      "SELECT COUNT(iims_session.session_id) AS Count FROM iims_session WHERE iims_session.session_id = ? LIMIT 1",
      [payload.session_id]
    );
    console.log("the status is", status);
    if (parseInt(status[0]["Count"]) === 0) {
      payload = null;
    }
  }
  console.log("new payload",payload)

  return payload;
};

exports._updateCaseReferrals = async (case_id) => {
  let successFull = false;
  try {
    const connection = await config._connect();
    let status = await connection.query(
      "SELECT iims_codebits_t_referrals.referral_id FROM iims_codebits_t_referrals WHERE (iims_codebits_t_referrals.case_id = ?) AND (iims_codebits_t_referrals.referral_status_id = 1)",
      [case_id]
    );
    status.filter(async (referral) => {
      status = await connection.query(
        "UPDATE iims_codebits_t_referrals SET iims_codebits_t_referrals.referral_status_id = 4 WHERE (iims_codebits_t_referrals.referral_id = ?)",
        [referral["referral_id"]]
      );
    });
    successFull = true;
  } catch (error) {
    successFull = false;
  }

  return successFull;
};

const _countParalegalReferrals = (exports._countParalegalReferrals = async (
  paralegal_id
) => {
  let count = 0;

  try {
    const connection = await config._connect();
    const status = await connection.query(
      "SELECT COUNT(paralegal_id) AS Count FROM iims_codebits_t_referrals WHERE paralegal_id = ? AND referral_status_id = 1",
      [paralegal_id]
    );
    count = status[0]["Count"];
  } catch (error) {
    count = 0;
  }

  return count;
});

const _countParalegalOpenCases = (exports._countParalegalOpenCases = async (
  paralegal_id
) => {
  let count = 0;

  try {
    const connection = await config._connect();
    const status = await connection.query(
      "SELECT DISTINCT COUNT(iims_law_client.name) AS Count FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2) AND (iims_law_cases.case_stage != 'Closed') ORDER BY iims_law_client.name ASC",
      [paralegal_id]
    );
    count = status[0]["Count"];
  } catch (error) {
    count = 0;
  }

  return count;
});

const _countParalegalClosedCases = (exports._countParalegalClosedCases = async (
  paralegal_id
) => {
  let count = 0;

  try {
    const connection = await config._connect();
    const status = await connection.query(
      "SELECT DISTINCT COUNT(iims_law_client.name) AS Count FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2) AND (iims_law_cases.case_stage = 'Closed') ORDER BY iims_law_client.name ASC",
      [paralegal_id]
    );
    count = status[0]["Count"];
  } catch (error) {
    count = 0;
  }

  return count;
});

exports._getParalegalNotificationToken = async (paralegal_id) => {
  let notifications_token = null;

  try {
    const connection = await config._connect();
    const results = await connection.query(
      "SELECT iims_codebits_t_paralegals.notifications_token FROM iims_codebits_t_paralegals WHERE iims_codebits_t_paralegals.paralegal_id = ?",
      [paralegal_id]
    );
    notifications_token = results[0].notifications_token;
  } catch (error) {
    notifications_token = null;
  }

  return notifications_token;
};

exports._getCaseDetailsByCaseId = async (case_id) => {
  let details;

  try {
    const connection = await config._connect();
    const results = await connection.query(
      "SELECT iims_law_firms.name AS lasps, iims_law_client.name AS client_name, iims_law_cases.title AS case_title, iims_law_cases.summary AS case_summary FROM iims_law_cases INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id INNER JOIN iims_law_firms ON iims_law_firms.firm_id = iims_law_cases.f_id WHERE iims_law_cases.id = ?",
      [case_id]
    );
    details = {
      lasps: results[0]["lasps"],
      client_name: results[0]["client_name"],
      case_title: results[0]["case_title"],
      case_summary: results[0]["case_summary"],
    };
  } catch (error) {
    details = null;
  }

  return details;
};

exports._getFirmDetailsByFirmId = async (firm_id) => {
  let details;

  try {
    const connection = await config._connect();
    const results = await connection.query(
      "SELECT iims_law_firms.name, iims_law_firms.address, iims_law_firms.phone_number, iims_law_firms.email FROM iims_law_firms WHERE (iims_law_firms.firm_id = ?)",
      [firm_id]
    );
    details = {
      name: results[0]["name"],
      address: results[0]["address"],
      phone_number: results[0]["phone_number"],
      email: results[0]["email"],
    };
  } catch (error) {
    details = null;
  }

  return details;
};

exports._login = async (email, password, remember_me) => {
  let payload;

  try {
    const connection = await config._connect();
    const result = await connection.query(
      "SELECT COUNT(iims_codebits_t_paralegals.hashed_password) AS Count, iims_codebits_t_paralegals.contact, iims_codebits_t_paralegals.village, iims_codebits_t_paralegals.field_of_expertise, iims_codebits_t_paralegals.image, iims_codebits_t_paralegals.fullname, iims_codebits_t_paralegals.hashed_password, iims_codebits_t_paralegals.firm_id, iims_codebits_t_paralegals.paralegal_id, iims_codebits_t_paralegals.firstname, iims_codebits_t_paralegals.surname, iims_codebits_t_paralegals.othername, iims_codebits_t_paralegals.preferred_language_id, iims_codebits_t_paralegals.other_languages, iims_codebits_t_paralegals.gender, iims_codebits_t_paralegals.subcounty_id, iims_codebits_t_paralegals.date_of_birth, iims_codebits_t_paralegals.chairperson_lc_1_fullname, iims_codebits_t_paralegals.chairperson_lc_1_contact, iims_codebits_t_paralegals.mosque_imam_name, iims_codebits_t_paralegals.mosque_imam_contact, iims_codebits_t_paralegals.mosque_committee_position, iims_codebits_t_paralegals.level_of_education FROM iims_codebits_t_paralegals WHERE (iims_codebits_t_paralegals.email = ?)",
      [email]
    );
    const passwordIsValid = bcrypt.compareSync(
      password,
      result[0]["hashed_password"]
    );

    if (result[0]["Count"] === "1" && passwordIsValid) {
      const tokenPayload = await config._generateToken(
        result[0]["paralegal_id"],
        result[0]["firm_id"],
        remember_me
      );
      console.log("the token payload is", tokenPayload);

      payload = {
        token: tokenPayload.token,
        exp: tokenPayload.exp,
        user: {
          email: email,
          name: result[0]["fullname"],
          image: result[0]["image"],
          address: result[0]["physical_address"],
          contact: result[0]["contact"],
          field_of_expertise: result[0]["field_of_expertise"],
          firm_id: result[0]["firm_id"],
          firstname: result[0]["firstname"],
          surname: result[0]["surname"],
          othername: result[0]["othername"],
          preferred_language_id: result[0]["preferred_language_id"],
          other_languages: result[0]["other_languages"],
          gender: result[0]["gender"],
          date_of_birth: result[0]["date_of_birth"],
          level_of_education: result[0]["level_of_education"],
          subcounty_id: result[0]["subcounty_id"],
          village: result[0]["village"],
          lc_1_chairperson_name: result[0]["chairperson_lc_1_fullname"],
          lc_1_chairperson_contact: result[0]["chairperson_lc_1_contact"],
          mosque_imam_name: result[0]["mosque_imam_name"],
          mosque_imam_contact: result[0]["mosque_imam_contact"],
          mosque_committee_position: result[0]["mosque_committee_position"],
          referrals: await _countParalegalReferrals(result[0]["paralegal_id"]),
          open_cases: await _countParalegalOpenCases(result[0]["paralegal_id"]),
          closed_cases: await _countParalegalClosedCases(
            result[0]["paralegal_id"]
          ),
        },
      };
    }
  } catch (error) {
    console.log("the error is", error);
    payload = null;
    // payload.token = "error:" + error;
  }

  return payload;
};

exports._enableCORS = (response) => {
  response.set("Access-Control-Allow-Origin", "*");
  response.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
};

exports._getParalegalDetailsbyId = async (paralegalId) => {
  let details;
  //  console.log("from para")
  try {
    const connection = await config._connect();
    const results = await connection.query(
      "SELECT fullname, email, contact, surname, hashed_password, image, firm_id, gender   FROM iims_codebits_t_paralegals WHERE paralegal_id = ?",
      [paralegalId]
    );
    // console.log("the results are", results);
    details = {
      name: results[0]["fullname"],
      surname: results[0]["surname"],
      hashedPassword: results[0]["hashed_password"],
      image: results[0]["image"],
      firm_id: results[0]["firm_id"],
      gender: results[0]["gender"],

      phone_number: results[0]["contact"],
      email: results[0]["email"],
    };
  } catch (error) {
    console.log("the error ", error);
    details = null;
  }

  return details;
};
