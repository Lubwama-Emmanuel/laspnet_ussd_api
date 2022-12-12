const catchAsync = require("./../utils/catchAsync");
const AppError = require("./../utils/appError");
const db = require("./../utils/config");
const bcrypt = require("bcryptjs");
const lib = require("./../utils/lib");
// const uuid = require("uuid-int");
const axios = require("axios");
exports.getSubCounties = catchAsync(async (req, res, next) => {
  const connection = await db._connect();
  const subcounties = await connection.query(
    "SELECT iims_codebits_rt_subcounties.subcounty_id, iims_codebits_rt_subcounties.subcounty_name, iims_codebits_rt_districts.district_name, iims_codebits_rt_regions.region_name FROM iims_codebits_rt_subcounties INNER JOIN iims_codebits_rt_districts ON iims_codebits_rt_districts.district_id = iims_codebits_rt_subcounties.district_id INNER JOIN iims_codebits_rt_regions ON iims_codebits_rt_regions.region_id = iims_codebits_rt_districts.region_id ORDER BY subcounty_name ASC"
  );
  // const sequelize = new Sequelize(
  //   "lasptorg_lasp_test",
  //   "lasptorg_lasp_test",
  //   "A2j@6102",
  //   {
  //     host: "zac-09.database.windows.net",
  //     dialect: "mysql",
  //     port: 3306,
  //   }
  // );
  // try {
  //   await sequelize.authenticate();
  //   console.log("Connection has been established successfully.");
  // } catch (error) {
  //   console.error("Unable to connect to the database:", error);
  // }
  res.status(200).send({ message: "OK", subcounties });
});
// http://httpbin.org/ip
exports.getRegions = catchAsync(async (req, res, next) => {
  // const connection = await db._connect();

  // const regions = await connection.query(
  //   "SELECT * FROM iims_codebits_rt_regions ORDER BY region_name ASC"
  // );
  await axios
    .get("http://httpbin.org/ip")
    .then((response) => {
      console.log(response.data);
      // console.log(response.da);
    })
    .catch((error) => {
      console.log(error);
    });
  res.status(200).send({ message: "OK" });
});

exports.getDistricts = catchAsync(async (req, res, next) => {
  const connection = await db._connect();

  const districts = await connection.query(
    "SELECT district_id, district_name FROM iims_codebits_rt_districts ORDER BY district_name ASC"
  );
  res.status(200).send({ message: "OK", districts });
});

exports.getDistrictsWithRegions = catchAsync(async (req, res, next) => {
  const connection = await db._connect();
  const districts = await connection.query(
    "SELECT district_id, district_name, region_name FROM iims_codebits_rt_districts INNER JOIN iims_codebits_rt_regions ON iims_codebits_rt_regions.region_id = iims_codebits_rt_districts.region_id ORDER BY district_name ASC"
  );
  res.status(200).send({ message: "OK", districts });
});

exports.getLanguages = catchAsync(async (req, res, next) => {
  const connection = await db._connect();
  const languages = await connection.query(
    "SELECT * FROM iims_codebits_rt_languages ORDER BY language_name ASC"
  );
  res.status(200).send({ message: "OK", languages });
});

exports.getLaspnetFirms = catchAsync(async (req, res, next) => {
  const connection = await db._connect();
  const lasps = await connection.query(
    "SELECT iims_law_firms.firm_id, iims_law_firms.name FROM iims_law_firms ORDER BY iims_law_firms.name ASC"
  );
  res.status(200).send({ message: "OK", lasps });
});

exports.createParalegal = catchAsync(async (req, res, next) => {
  const {
    firstname,
    othername,
    surname,
    email,
    contact,
    gender,
    image,
    field_of_expertise,
    firm_id,
    subcounty_id,
    village,
    preferred_language_id,
    other_languages,
    password,
    recovery_question,
    recovery_answer,
    date_of_birth,
    level_of_education,
    lc_1_chairperson_name,
    lc_1_chairperson_telephone,
    mosque_imam_name,
    mosque_imam_contact,
    mosque_committee_position,
  } = req.body;

  // const id = uuid(500).uuid();
  // console.log("the id is", id);
  const connection = await db._connect();
  const result = await connection.query(
    "SELECT paralegal_id FROM iims_codebits_t_paralegals WHERE iims_codebits_t_paralegals.email = ?",
    [email]
  );

  if (result.length) {
    return next(
      new AppError("Operation Failed: Account exists, try signing in", 403)
    );
  }
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
      "(firstname, surname, othername, email, contact, fullname, gender, image, field_of_expertise, firm_id, subcounty_id, village, preferred_language_id, other_languages, password, hashed_password, recovery_question, recovery_answer, date_of_birth, chairperson_lc_1_fullname, chairperson_lc_1_contact, level_of_education, mosque_imam_name, mosque_imam_contact, mosque_committee_position)" +
      "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
      firm_id,
      subcounty_id,
      village,
      preferred_language_id,
      other_languages,
      password,
      hashedPassword,
      recovery_question,
      recovery_answer,
      date_of_birth,
      lc_1_chairperson_name,
      lc_1_chairperson_telephone,
      level_of_education,
      mosque_imam_name,
      mosque_imam_contact,
      mosque_committee_position,
    ]
  );

  // console.log("the staus is",status)
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
      firm_id,
      contact,
      gender,
      10,
      status.insertId,
      1,
    ]
  );
  if (status.affectedRows !== 1 || users.affectedRows !== 1) {
    console.log("the staus is", status);
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
        ",</h3> <p style='color: #494949;'>Your  account has been created. Please wait for activation"
    );
    if (!email_status || email_status === undefined || email_status === null) {
      response_message += "but the email was not sent.";
    } else if (email_status["accepted"].length) {
      response_message += "and an email sent to the Paralegal";
    }
  }
  // const payload = await lib._login(email, password, "false");
  res.status(201).send({
    message: "Operation Successful: Account created.",
    // payload: payload,
  });
});
