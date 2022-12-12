const catchAsync = require("./../utils/catchAsync");
const AppError = require("./../utils/appError");
const db = require("./../utils/config");
const bcrypt = require("bcryptjs");
const lib = require("./../utils/lib");
const e = require("express");

const menuName = ['Register as a paralegal', 'My account', 'Inquiry']
const caseType = ['Civil', 'Criminal', 'Domestic Violence', 'Land Disputes', 'Trespassing']
const caseEmegency = ['Low', 'Medium', 'High', 'Severe']
const languageName = ['English', 'Kiswahili', 'Luganda', 'Runyakole', 'Lugisu', 'Other']

exports.handleSession = catchAsync(async (req, res, next) => {
  const { sessionId, serviceCode, phoneNumber, text } = req.body;

  let response = "";

  if (text == "") {
    // This is the first request. Note how we start the response with CON
    response = `CON Welcome to LASPNET paralegal pathway
        1) Register as a paralegal
        2) My account
        3) Inquiry`;
  } else if (text == "1") {
    // ? IF USER CHOOSES OPTION 1 (REGISTER AS A PARALEGAL)

    response = `CON Please choose your gender
    1) Female
    2) Male`
  } else if (/^1\*[1|2]$/.test(text)) {
    // Taking Option 1(Register) and getting phone number from user

    response = `CON Please enter your district code.`
  } else if (/^1\*[1|2]\*\d{1}$/.test(text)) {
    // Taking Option 1(Register), phone number and gender then enter district code

    response = `CON Please type your preferred LASP number`;
  } else if (/^1\*[1|2]\*\d{1}\*\d{1}$/.test(text)) {
    // Taking Option 1(Register), phone number, gender, district code then enter prefered LASP

    response = `CON Please choose a language(s)
    1) English
    2) Kiswahili
    3) Luganda
    4) Lou
    5) Runyakole
    6) Lugisu
    7) Other`;
  } else if (/^1\*[1|2]\*\d{1}\*\d{1}\*[1-7]$/.test(text)) {
    // Taking Option 1(Register), phone number, gender, district code, prefered LASP then choose language

    response = `END Your application has been sent to the
    LASP of your choice.You will be contacted to confirm
    your approval. Thank you.
    00) Main menu`;
    // console.log(text)
    const userInput = text.split("*");
    // console.log(userInput)

    const userFields = [
      "menuOption",
      "contact",
      "gender",
      "district_id",
      "lasp_number",
      "preferred_language_id"
    ];

    // Object to send to database
    const userObject = {};
    userFields.forEach((element, index) => {
      userObject[element] = userInput[index];
    });

    if (userObject.gender == 1) {
      userObject.gender = "Female";
    } else if (userObject.gender == 2) {
      userObject.gender = "Male";
    }
    userObject.menuOption = menuName[userObject.menuOption - 1]
    console.log(userObject)

    // SAVING TO DATABASE
    // Save registered user to database
    // const connection = await db._connect();

    // // check if useremail exists or not
    // const result = await connection.query(
    //   "SELECT paralegal_id FROM iims_codebits_t_paralegals WHERE iims_codebits_t_paralegals.contact = ?",
    //   [userObject.contact]
    // );

    // console.log(result.length)
    // if (result.length) {
    //   // If email exists, END connection with a message below
    //   response = `END Account exists, try signing in.`
    // }
    // const status = await connection.query(
    //   "INSERT INTO iims_codebits_t_paralegals" +
    //   "(contact, gender, preferred_language_id, district_id, lasp_number)" +
    //   "VALUES(?, ?, ?)",
    //   [
    //     userObject.contact, userObject.gender, userObject.preferred_language_id, userObject.district_id, userObject.lasp_number
    //   ])

  } else if (text == "2") {
    // ? IF USER CHOOSES OPTION 2(MY ACCOUNT)

    response = `CON LASPNET Paralegal Account
    1) Report a Case
    2) Ongoing cases
    3) Case Referrals
    4) Executed Cases`;

  } else if (/^2\*1$/.test(text)) {
    // If user chose 2(MY ACCOUNT) and phone number, report case then choose nature of case

    response = `CON Please choose the nature of case
    1) Criminal
    2) Civil
    3) Domestic Violence
    4) Land Disputes
    5) Trespassing`;

  } else if (/^2\*1\*[1-5]$/.test(text)) {
    // If user chose 2(MY ACCOUNT) and phone number, report case, nature of case then enter district code

    response = `CON Please enter your district code.`
  } else if (/^2\*1\*[1-5]\*\d{1}$/.test(text)) {
    // If user chose 2(MY ACCOUNT) and phone number, report case, nature of case, district code
    // choose level of emergency

    response = `CON Please choose the level of emergency
    1) Low
    2) Medium
    3) High
    4) Severe`
  } else if (/^2\*1\*[1-5]\*\d{1}\*[1-4]$/.test(text)) {
    // If user chose 2(MY ACCOUNT) and phone number, report case, nature of case, district code
    // and level of emergency 

    response = `END Your case has been reported. A Legal Aid
    Service Provider will contact you and
    follow up with you. Thank you.
    00) Main menu`

    // Store reported ca  aqse to database
    console.log(text)
    const userInput = text.split("*")
    console.log(userInput)

    const userField = [
      "menuOption",
      "phoneNumber",
      "laspnetAccount",
      "natureOfCase",
      "districtCode",
      "emergencyLevel"
    ]

    // Object to store case reported to database
    const userObject = {};

    userField.forEach((element, index) => {
      userObject[element] = userInput[index]
    })
    userObject.natureOfCase = caseType[userObject.natureOfCase - 1]
    userObject.emergencyLevel = caseEmegency[userObject.emergencyLevel - 1]

    console.log(userObject)
  } else if (/^2\*[2|4]$/.test(text)) {
    // If user chose 2(MY ACCOUNT) and phone number, Ongoing cases or executed cases
    // Then choose case

    response = `CON Ongoing Cases
    1. Case 1
    2. Case 2
    3. Case 3
    4. Case 4`;
  } else if (/^2\*[2|4]\*[1-4]$/.test(text)) {
    // If user chose 2(MY ACCOUNT) and phone number, Ongoing cases or executed cases
    // End connection by returning case

    response = `END Case 1 summary
    Nature of Case: Domestic Voilence
    Applicant: Muhumuza
    Respondent: Mirema
    Case summary:
    Mrs Mirema beat up her husband on...`;
  } else if (/^2\*3/.test(text)) {
    // If user chose 2(MY ACCOUNT) and phone number, case inquiry and End connection

    response = `END Case 1 summary
        Nature of Case: Domestic Voilence
        Applicant: Muhumuza
        Respondent: Mirema
        Case summary:
        Mrs Mirema beat up her husband on...
        1. Accept
        2. Reject`;

  } else if (text == "3") {
    // ? IF USER CHOOSES OPTION 3(INQUIRY)
    // If user chose option 3(INQUIRY), district code then choose inquiry option 

    response = `CON LASPNET USSD Inquiry
    1. About LASPNET
    2. How to get legal Aid
    3. How to become a paralegal
    4. How to report a case`;

  } else if (/^3\*[1-4]$/.test(text)) {
    // If user chose option 3(INQUIRY), district code, inquiry option End connection

    response = `END Thank you for your submission. You will
    receive a call or SMS for more details
    about your inquiry soon.
    00) Main menu`
  }

  // console.log(text)
  res.set("Content-Type: text/plain");
  res.send(response);
});

// SAVING TO DATABASE
// // Save registered user to database
// const connection = await db._connect();

// // check if useremail exists or not
// const result = await connection.query(
//   "SELECT paralegal_id FROM iims_codebits_t_paralegals WHERE iims_codebits_t_paralegals.email = ?",
//   [userObject.email]
// );

// if (result.length) {
//   // If email exists, END connection with a message below
//   response = `END Account exists, try signing in.`
// }
// const status = await connection.query(
//   "INSERT INTO iims_codebits_t_paralegals" +
//   "(fullname, email, surname, gender, village, lasps, field_of_expertise, preferred_language_id, other_languages)" +
//   "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)",
//   [
//     userObject.fullname, userObject.email, userObject.surname, userObject.gender, userObject.village, userObject.lasps, userObject.field_of_expertise, userObject.preferred_language_id, userObject.other_languages
//   ])