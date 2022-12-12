"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.iims_editParalegal = exports.iims_fetchParalegalAccountDetails = exports.iims_deleteParalegal = exports.iims_registerParalegal = exports.iims_viewParalegalReferrals = exports.iims_getCases = exports.iims_getReferralDetails = exports.iims_deleteReferral = exports.iims_editReferral = exports.iims_createReferral = exports.sendEmail = exports.verifyRecoveryQuestionAnswer = exports.getAccountRecoveryQuestion = exports.changeParalegalAccountPassword = exports.updateParalegalAccount = exports.declineCaseReferral = exports.acceptCaseReferral = exports.getParalegalCaseReferrals = exports.getParalegalCaseDetails = exports.getParalegalCases = exports.getParalegalClientCases = exports.getParalegalClients = exports.getClientCaseDetails = exports.getExecutedParalegalClientCases = exports.getExecutedParalegalClients = exports.allowNotifications = exports.createParalegal = exports.onLogin = exports.getUsers = exports.getLaspnetFirms = exports.getLanguages = exports.getDistrictsWithRegions = exports.getDistricts = exports.getSubcounties = exports.getRegions = void 0;
const functions = require("firebase-functions");
const config_1 = require("./config");
const lib_1 = require("./lib");
const bcrypt = require('bcryptjs');
const admin = require("firebase-admin");
admin.initializeApp();
/*
*
*   Referential Data Endpoints
*
*/
exports.getRegions = functions.https.onRequest(async (request, response) => {
    try {
        const connection = await config_1._connect();
        const regions = await connection.query('SELECT * FROM iims_codebits_rt_regions ORDER BY region_name ASC');
        response.status(200).send({ message: 'OK', regions });
    }
    catch (error) {
        response.status(500).send({ message: 'Operation Failed: An error occured.' });
    }
});
exports.getSubcounties = functions.https.onRequest(async (request, response) => {
    try {
        const connection = await config_1._connect();
        const subcounties = await connection.query('SELECT iims_codebits_rt_subcounties.subcounty_id, iims_codebits_rt_subcounties.subcounty_name, iims_codebits_rt_districts.district_name, iims_codebits_rt_regions.region_name FROM iims_codebits_rt_subcounties INNER JOIN iims_codebits_rt_districts ON iims_codebits_rt_districts.district_id = iims_codebits_rt_subcounties.district_id INNER JOIN iims_codebits_rt_regions ON iims_codebits_rt_regions.region_id = iims_codebits_rt_districts.region_id ORDER BY subcounty_name ASC');
        response.status(200).send({ message: 'OK', subcounties });
    }
    catch (error) {
        response.status(500).send({ message: 'Operation Failed: An error occured.' });
    }
});
exports.getDistricts = functions.https.onRequest(async (request, response) => {
    try {
        const connection = await config_1._connect();
        const districts = await connection.query('SELECT district_id, district_name FROM iims_codebits_rt_districts ORDER BY district_name ASC');
        response.status(200).send({ message: 'OK', districts });
    }
    catch (error) {
        response.status(500).send({ message: 'Operation Failed: An error occured.' });
    }
});
exports.getDistrictsWithRegions = functions.https.onRequest(async (request, response) => {
    try {
        const connection = await config_1._connect();
        const districts = await connection.query('SELECT district_id, district_name, region_name FROM iims_codebits_rt_districts INNER JOIN iims_codebits_rt_regions ON iims_codebits_rt_regions.region_id = iims_codebits_rt_districts.region_id ORDER BY district_name ASC');
        response.status(200).send({ message: 'OK', districts });
    }
    catch (error) {
        response.status(500).send({ message: 'Operation Failed: An error occured.' });
    }
});
exports.getLanguages = functions.https.onRequest(async (request, response) => {
    try {
        const connection = await config_1._connect();
        const languages = await connection.query('SELECT * FROM iims_codebits_rt_languages ORDER BY language_name ASC');
        response.status(200).send({ message: 'OK', languages });
    }
    catch (error) {
        response.status(500).send({ message: 'Operation Failed: An error occured.' });
    }
});
exports.getLaspnetFirms = functions.https.onRequest(async (request, response) => {
    try {
        const connection = await config_1._connect();
        const lasps = await connection.query('SELECT iims_law_firms.firm_id, iims_law_firms.name FROM iims_law_firms ORDER BY iims_law_firms.name ASC');
        response.status(200).send({ message: 'OK', lasps });
    }
    catch (error) {
        console.log('error:', error);
        response.status(500).send({ message: 'Operation Failed: An error occured.' });
    }
});
exports.getUsers = functions.https.onRequest(async (request, response) => {
    const payload = lib_1._getAuthPayload(request, response);
    if (payload) {
        try {
            const connection = await config_1._connect();
            const users = await connection.query('SELECT * FROM iims_users');
            response.status(200).send({ message: 'OK', users });
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
/*
*
*   Mobile Application Endpoints
*
*/
exports.onLogin = functions.https.onRequest(async (request, response) => {
    try {
        const { email, password, remember_me } = JSON.parse(request.body);
        const payload = await lib_1._login(email, password, remember_me);
        if (payload) {
            response.status(200).send({ message: 'OK', payload });
        }
        else {
            response.status(400).send({ message: 'Invalid Credentails', payload: payload });
        }
    }
    catch (error) {
        response.status(500).send({ message: 'Operation Failed: ' + (request.body.length === undefined ? 'Empty body' : 'An error occured.') });
    }
});
exports.createParalegal = functions.https.onRequest(async (request, response) => {
    try {
        const { firstname, othername, surname, email, contact, gender, image, field_of_expertise, firm_id, subcounty_id, village, preferred_language_id, other_languages, password, recovery_question, recovery_answer, date_of_birth, level_of_education, lc_1_chairperson_name, lc_1_chairperson_telephone, mosque_imam_name, mosque_imam_contact, mosque_committee_position } = JSON.parse(request.body);
        const connection = await config_1._connect();
        // Check if the account exists.
        const result = await connection.query("SELECT paralegal_id FROM iims_codebits_t_paralegals WHERE iims_codebits_t_paralegals.email = ?", [email]);
        if (result.length) {
            response.status(403).send({ message: 'Operation Failed: Account exists' });
        }
        else {
            const hashedPassword = bcrypt.hashSync(password, 10);
            // Register the paralegal
            const fullname = (gender === 'Male' ? 'Mr. ' : 'Ms. ') + firstname + ' ' + surname + ' ' + othername;
            const status = await connection.query("INSERT INTO iims_codebits_t_paralegals"
                + "(firstname, surname, othername, email, contact, fullname, gender, image, field_of_expertise, firm_id, subcounty_id, village, preferred_language_id, other_languages, password, hashed_password, recovery_question, recovery_answer, date_of_birth, chairperson_lc_1_fullname, chairperson_lc_1_contact, level_of_education, mosque_imam_name, mosque_imam_contact, mosque_committee_position)"
                + "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [firstname, surname, othername, email, contact, fullname, gender, image, field_of_expertise, firm_id, subcounty_id, village, preferred_language_id, other_languages, password, hashedPassword, recovery_question, recovery_answer, date_of_birth, lc_1_chairperson_name, lc_1_chairperson_telephone, level_of_education, mosque_imam_name, mosque_imam_contact, mosque_committee_position]);
            if (status.affectedRows === 1) {
                const payload = await lib_1._login(email, password, 'false');
                response.status(201).send({ message: 'Operation Successful: Account created.', payload: payload });
            }
            else {
                response.status(500).send({ message: 'Operation Failed: Account not created.' });
            }
        }
    }
    catch (error) {
        response.status(500).send({ message: 'Operation Failed: ' + (request.body.length === undefined ? 'Empty body' : 'An error occured.') });
    }
});
exports.allowNotifications = functions.https.onRequest(async (request, response) => {
    const payload = lib_1._getAuthPayload(request, response);
    if (payload) {
        try {
            const { notifications_token } = JSON.parse(request.body);
            const connection = await config_1._connect();
            const status = await connection.query("UPDATE iims_codebits_t_paralegals SET"
                + "  iims_codebits_t_paralegals.notifications_token = ?"
                + "WHERE iims_codebits_t_paralegals.paralegal_id = ?", [notifications_token, payload.paralegal_id]);
            response.status(200).send({ message: 'Operation Successful: Notifications enabled', affectedRows: status.affectedRows });
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.getExecutedParalegalClients = functions.https.onRequest(async (request, response) => {
    const payload = lib_1._getAuthPayload(request, response);
    if (payload) {
        try {
            const connection = await config_1._connect();
            const clients = await connection.query("SELECT DISTINCT iims_law_client.name, iims_law_client.id as client_id FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2) AND (iims_law_cases.case_stage = 'Closed') ORDER BY iims_law_client.name ASC", [payload.paralegal_id]);
            response.status(200).send({ message: 'OK', clients });
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.getExecutedParalegalClientCases = functions.https.onRequest(async (request, response) => {
    const payload = lib_1._getAuthPayload(request, response);
    if (payload) {
        try {
            const { client_id } = JSON.parse(request.body);
            const connection = await config_1._connect();
            const cases = await connection.query("SELECT iims_law_cases.title as case_title, iims_law_cases.id as case_id FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND (iims_law_client.id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2) AND (iims_law_cases.case_stage = 'Closed') ORDER BY iims_law_cases.title ASC", [payload.paralegal_id, client_id]);
            response.status(200).send({ message: 'OK', cases });
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.getClientCaseDetails = functions.https.onRequest(async (request, response) => {
    const payload = lib_1._getAuthPayload(request, response);
    if (payload) {
        try {
            const { case_id } = JSON.parse(request.body);
            const connection = await config_1._connect();
            const cases_details = await connection.query("SELECT iims_law_client.name as client_name, iims_law_cases.title as case_title, iims_law_cases.summary as case_summary, iims_law_cases.type as case_type, iims_law_cases.ref_no as case_ref_no, iims_law_cases.intervention as case_intervention, iims_law_cases.outcome_intervention, iims_law_cases.expectation as case_expectation, iims_law_cases.expectation_l as case_expectation_l, iims_law_cases.pathway as case_pathway, iims_law_client.occupation as client_occupation, iims_law_client.phone as client_contact, iims_law_cases.case_stage as case_progress, iims_law_firms.name as firm_name FROM iims_law_cases INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id INNER JOIN iims_law_firms ON iims_law_firms.firm_id = iims_law_cases.f_id WHERE (iims_law_cases.id = ?)", [case_id]);
            response.status(200).send({ message: 'OK', cases_details });
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.getParalegalClients = functions.https.onRequest(async (request, response) => {
    const payload = lib_1._getAuthPayload(request, response);
    if (payload) {
        try {
            const connection = await config_1._connect();
            const clients = await connection.query("SELECT DISTINCT iims_law_client.name, iims_law_client.id as client_id FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2) AND (iims_law_cases.case_stage != 'Closed') ORDER BY iims_law_client.name ASC", [payload.paralegal_id]);
            response.status(200).send({ message: 'OK', clients });
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.getParalegalClientCases = functions.https.onRequest(async (request, response) => {
    const payload = lib_1._getAuthPayload(request, response);
    if (payload) {
        try {
            const { client_id } = JSON.parse(request.body);
            const connection = await config_1._connect();
            const cases = await connection.query("SELECT iims_law_cases.title as case_title, iims_law_cases.id as case_id FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND (iims_law_client.id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2) AND (iims_law_cases.case_stage != 'Closed') ORDER BY iims_law_cases.title ASC", [payload.paralegal_id, client_id]);
            response.status(200).send({ message: 'OK', cases });
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.getParalegalCases = functions.https.onRequest(async (request, response) => {
    const payload = lib_1._getAuthPayload(request, response);
    if (payload) {
        try {
            const connection = await config_1._connect();
            const cases = await connection.query("SELECT DISTINCT iims_law_client.name, iims_law_cases.id FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2) AND (iims_law_cases.case_stage != 'Closed') ORDER BY iims_law_client.name ASC", [payload.paralegal_id]);
            response.status(200).send({ message: 'OK', cases });
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.getParalegalCaseDetails = functions.https.onRequest(async (request, response) => {
    const payload = lib_1._getAuthPayload(request, response);
    if (payload) {
        try {
            const { case_id } = JSON.parse(request.body);
            const connection = await config_1._connect();
            const caseDetails = await connection.query("SELECT iims_law_cases.title, iims_law_cases.type, iims_law_cases.summary, iims_law_cases.ref_no, iims_law_cases.intervention, iims_law_cases.outcome_intervention, iims_law_cases.expectation, iims_law_cases.expectation_l, iims_law_cases.action, iims_law_cases.reporting_date, iims_law_cases.incident_date, iims_law_client.name, iims_law_client.sex, iims_law_client.phone, iims_law_client.occupation, iims_law_client.language, iims_law_client.level, iims_law_client.disabilities, iims_law_zone.name AS district, iims_law_client.subcounty, iims_law_client.next_of_kin, iims_law_client.tel_nok, iims_law_client.home_address, iims_law_client.date_of_birth FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id INNER JOIN iims_law_zone ON iims_law_zone.zone_id = iims_law_client.district WHERE (iims_law_cases.id = ?) AND (iims_codebits_t_referrals.paralegal_id = ?)", [case_id, payload.paralegal_id]);
            if (caseDetails.length) {
                response.status(200).send({ message: 'OK', caseDetails });
            }
            else {
                console.log(caseDetails.length);
                response.status(404).send({ message: 'Sorry, case details not found.', case_id: case_id });
            }
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.getParalegalCaseReferrals = functions.https.onRequest(async (request, response) => {
    const payload = lib_1._getAuthPayload(request, response);
    if (payload) {
        try {
            const connection = await config_1._connect();
            const referrals = await connection.query("SELECT iims_codebits_t_referrals.referral_id, iims_codebits_t_referrals.referral_action_requested, iims_codebits_t_referrals.referral_datetime, iims_codebits_t_referrals.case_id, iims_law_cases.title, iims_law_cases.type, iims_law_cases.summary, iims_law_client.name, iims_law_firms.name AS firm FROM iims_codebits_t_referrals INNER JOIN iims_law_cases ON iims_law_cases.id = iims_codebits_t_referrals.case_id  INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id  INNER JOIN iims_law_firms ON iims_law_firms.firm_id = iims_law_cases.f_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND (iims_codebits_t_referrals.referral_status_id = 1)", [payload.paralegal_id]);
            response.status(200).send({ message: 'OK', referrals });
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.acceptCaseReferral = functions.https.onRequest(async (request, response) => {
    const payload = lib_1._getAuthPayload(request, response);
    if (payload) {
        try {
            const { referral_id, case_id } = JSON.parse(request.body);
            const connection = await config_1._connect();
            // First check if the case referral has not been accepted by any other paralegal.
            let status = await connection.query("SELECT COUNT(iims_codebits_t_referrals.referral_id) Count FROM iims_codebits_t_referrals WHERE (iims_codebits_t_referrals.case_id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2)", [case_id]);
            if (parseInt(status[0]['Count']) >= 1) {
                const result = await connection.query("UPDATE iims_codebits_t_referrals SET iims_codebits_t_referrals.referral_status_id = 4 WHERE (iims_codebits_t_referrals.referral_id = ?) AND (iims_codebits_t_referrals.paralegal_id = ?)", [referral_id, payload.paralegal_id]);
                response.status(410).send({ message: 'Operation Failed: The referral has been accepted by another paralegal.', result });
            }
            else {
                // Accept a referral
                status = await connection.query("UPDATE iims_codebits_t_referrals SET iims_codebits_t_referrals.referral_status_id = 2, iims_codebits_t_referrals.status_change_datetime = ? WHERE (iims_codebits_t_referrals.referral_id = ?) AND (iims_codebits_t_referrals.paralegal_id = ?) AND (iims_codebits_t_referrals.referral_status_id = 1)", [new Date(), referral_id, payload.paralegal_id]);
                await lib_1._updateCaseReferrals(case_id);
                response.status(200).send({ message: 'Operation Successful: Referral accepted', status });
            }
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.declineCaseReferral = functions.https.onRequest(async (request, response) => {
    const payload = lib_1._getAuthPayload(request, response);
    if (payload) {
        try {
            const { referral_id, reason } = JSON.parse(request.body);
            const connection = await config_1._connect();
            const status = await connection.query("UPDATE iims_codebits_t_referrals SET iims_codebits_t_referrals.referral_status_id = 3, iims_codebits_t_referrals.status_change_datetime = ?, iims_codebits_t_referrals.status_change_reason = ? WHERE (iims_codebits_t_referrals.referral_id = ?) AND (iims_codebits_t_referrals.paralegal_id = ?) AND (iims_codebits_t_referrals.referral_status_id != 2)", [new Date(), reason, referral_id, payload.paralegal_id]);
            response.status(200).send({ message: 'OK', affectedRows: status.affectedRows });
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.updateParalegalAccount = functions.https.onRequest(async (request, response) => {
    const payload = lib_1._getAuthPayload(request, response);
    if (payload) {
        try {
            const { firstname, othername, surname, contact, gender, image, field_of_expertise, firm_id, subcounty_id, village, preferred_language_id, other_languages, date_of_birth, level_of_education, lc_1_chairperson_name, lc_1_chairperson_telephone, mosque_imam_name, mosque_imam_contact, mosque_committee_position } = JSON.parse(request.body);
            const fullname = (gender === 'Male' ? 'Mr. ' : 'Ms. ') + firstname + ' ' + surname + ' ' + othername;
            const connection = await config_1._connect();
            const status = await connection.query("UPDATE iims_codebits_t_paralegals SET"
                + " iims_codebits_t_paralegals.firstname = ?,"
                + " iims_codebits_t_paralegals.surname = ?,"
                + " iims_codebits_t_paralegals.othername = ?,"
                + " iims_codebits_t_paralegals.fullname = ?,"
                + " iims_codebits_t_paralegals.contact = ?,"
                + " iims_codebits_t_paralegals.gender = ?,"
                + " iims_codebits_t_paralegals.image = ?,"
                + " iims_codebits_t_paralegals.field_of_expertise = ?,"
                + " iims_codebits_t_paralegals.firm_id = ?,"
                + " iims_codebits_t_paralegals.subcounty_id = ?,"
                + " iims_codebits_t_paralegals.village = ?,"
                + " iims_codebits_t_paralegals.preferred_language_id = ?,"
                + " iims_codebits_t_paralegals.other_languages = ?,"
                + " iims_codebits_t_paralegals.date_of_birth = ?,"
                + " iims_codebits_t_paralegals.level_of_education = ?,"
                + " iims_codebits_t_paralegals.chairperson_lc_1_fullname = ?,"
                + " iims_codebits_t_paralegals.chairperson_lc_1_contact = ?,"
                + " iims_codebits_t_paralegals.mosque_imam_name = ?,"
                + " iims_codebits_t_paralegals.mosque_imam_contact = ?,"
                + " iims_codebits_t_paralegals.mosque_committee_position = ?"
                + " WHERE (iims_codebits_t_paralegals.paralegal_id = ?)", [
                firstname, surname, othername, fullname, contact, gender, image,
                field_of_expertise, firm_id, subcounty_id, village,
                preferred_language_id, other_languages, date_of_birth,
                level_of_education, lc_1_chairperson_name, lc_1_chairperson_telephone,
                mosque_imam_name, mosque_imam_contact, mosque_committee_position,
                payload.paralegal_id
            ]);
            response.status(200).send({ message: 'Operation Successful', affectedRows: status.affectedRows });
        }
        catch (error) {
            console.log('error:', error);
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.changeParalegalAccountPassword = functions.https.onRequest(async (request, response) => {
    const payload = lib_1._getAuthPayload(request, response);
    if (payload) {
        try {
            const { current_password, new_password } = JSON.parse(request.body);
            const connection = await config_1._connect();
            const result = await connection.query("SELECT iims_codebits_t_paralegals.hashed_password FROM iims_codebits_t_paralegals WHERE (iims_codebits_t_paralegals.paralegal_id = ?)", [payload.paralegal_id]);
            const passwordIsValid = bcrypt.compareSync(current_password, result[0]['hashed_password']);
            if (!passwordIsValid) {
                response.status(200).send({ message: 'Operation Failed: The passwords do not match' });
            }
            const status = await connection.query("UPDATE iims_codebits_t_paralegals SET"
                + " iims_codebits_t_paralegals.password = ?,"
                + " iims_codebits_t_paralegals.hashed_password = ?"
                + " WHERE (iims_codebits_t_paralegals.paralegal_id = ?)", [new_password, bcrypt.hashSync(new_password, 10), payload.paralegal_id]);
            response.status(200).send({ message: 'Operation Successful: Password updated', affectedRows: status.affectedRows });
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.getAccountRecoveryQuestion = functions.https.onRequest(async (request, response) => {
    try {
        const { account_email_address } = JSON.parse(request.body);
        const connection = await config_1._connect();
        const result = await connection.query("SELECT iims_codebits_t_paralegals.recovery_question FROM iims_codebits_t_paralegals WHERE (iims_codebits_t_paralegals.email = ?)", [account_email_address]);
        if (result.length) {
            response.status(200).send({ message: 'Ok', question: result[0]['recovery_question'] });
        }
        else {
            response.status(400).send({ message: 'Operation Failed: Invalid account email address.' });
        }
    }
    catch (error) {
        response.status(500).send({ message: 'Operation Failed: An error occured.' });
    }
});
exports.verifyRecoveryQuestionAnswer = functions.https.onRequest(async (request, response) => {
    try {
        const { account_email_address, recovery_question, recovery_answer } = JSON.parse(request.body);
        const connection = await config_1._connect();
        const result = await connection.query("SELECT COUNT(iims_codebits_t_paralegals.recovery_question) AS Count, iims_codebits_t_paralegals.paralegal_id, iims_codebits_t_paralegals.firm_id FROM iims_codebits_t_paralegals WHERE (iims_codebits_t_paralegals.email = ?) AND (iims_codebits_t_paralegals.recovery_question = ?) AND (iims_codebits_t_paralegals.recovery_answer = ?)", [account_email_address, recovery_question, recovery_answer]);
        if (result[0]['Count'] === '1') {
            const tokenPayload = await config_1._generateToken(result[0]['paralegal_id'], result[0]['firm_id'], 'false');
            response.status(200).send({ message: 'Operation Successful.', token: tokenPayload.token, exp: tokenPayload.exp });
        }
        else {
            response.status(400).send({ message: 'Operation Failed: Wrong answer.' });
        }
    }
    catch (error) {
        response.status(500).send({ message: 'Operation Failed: An error occured.' });
    }
});
exports.sendEmail = functions.https.onRequest(async (request, response) => {
    const payload = lib_1._getAuthPayload(request, response);
    if (payload) {
        try {
            const { email_address } = JSON.parse(request.body);
            const status = await config_1._sendEmail(email_address, "It's Mark", "Testing the emailing function", "<b>Testing the emailing function</b>");
            console.log('status:', status);
            if (status['accepted']) {
                response.status(200).send({ message: 'Operation Successful: The email has been sent', status });
            }
            else {
                response.status(200).send({ message: 'Operation Failed: Email not sent', status });
            }
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
// Pending Endpoints
// Update the status of a case... Closed / (Interview / Consultation).... Future upgrade.
// Configure the fcm notifications.
/*
*
*   IIMS Endpoints
*
*/
exports.iims_createReferral = functions.https.onRequest(async (request, response) => {
    lib_1._enableCORS(response);
    const payload = await lib_1._getIIMSAuthPayload(request, response);
    if (payload) {
        try {
            const { case_id, case_title, case_summary, client_name, paralegal_info, message } = request.body;
            // console.log('case_id:', case_id);
            // console.log('paralegal_info:', paralegal_info);
            // console.log('client_name:', client_name);
            // console.log('case_title:', case_title);
            // console.log('case_summary:', case_summary);
            // console.log('message:', message);
            const paralegal_info_array = paralegal_info.split(':');
            const paralegal_id = paralegal_info_array[0];
            const paralegal_email = paralegal_info_array[1];
            const paralegal_contact = paralegal_info_array[2];
            const paralegal_fullname = paralegal_info_array[3];
            // console.log('paralegal_id:', paralegal_id);
            // console.log('paralegal_email:', paralegal_email);
            console.log('paralegal_contact:', paralegal_contact);
            // console.log('paralegal_fullname:', paralegal_fullname);
            const firm_details = await lib_1._getFirmDetailsByFirmId(payload.firm_id);
            const connection = await config_1._connect();
            const status = await connection.query("INSERT INTO iims_codebits_t_referrals (case_id, paralegal_id, referral_action_requested)"
                + "VALUES (?, ?, ?)", [case_id, paralegal_id, message]);
            // Push a firebase notification to the paralegal. 
            // const db_token = await _getParalegalNotificationToken(paralegal_id)
            // console.log('db_token:', db_token);
            // const token = "c7vwiKq9RamnWKRYrsi3TW:APA91bHj4AUrrh6KZoBbnUbkIbRE28ROJpfCl57URixW84LXYQtspeoA7TQFZ3xRNZpDKMh0YYDi_uHPVg_hiadPX9o588IFPza7Y1eIXXo1CUbX8EGggWO4AP8qXPiJAJcnehahPT5E"
            // // const caseDetails = await _getCaseDetailsByCaseId(case_id);
            // const notification_message = {
            //     data: {
            //         title: caseDetails.lasps +'('+ caseDetails.case_title +')',
            //         body:  message,                    
            //         client_name: caseDetails.client_name,
            //         case_summary: caseDetails.case_summary,
            //     }
            // };         
            // const result = await _sendNotification(token, notification_message);
            // console.log('result:', result);
            let response_message = 'Operation Successful: Referral created ';
            // Send email notification
            if (paralegal_email) {
                const email_status = await config_1._sendEmail(
                // paralegal_email, 
                'kajubimark2@gmail.com', "Case Referral " + (client_name ? 'For ' + client_name : ''), "Case Ttitle: " + case_title + ' Case Summary: ' + case_summary + ' Message: ' + message, "<h3>Dear " + paralegal_fullname + ",</h3> <p style='color: #494949;'>You have received a case referral from <b>" + firm_details.name + "</b> with the following details.</p><h4 style='margin-bottom: 0px;'>Case Title </h4><p style='margin-top: 3px; font-weight: 700; color: #494949;'>" + case_title + "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Case Summary </h4><p style='margin-top: 3px; color: #494949;'>" + case_summary + "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Requested Action </h4><p style='margin-top: 3px; color: #494949;'>" + message + "</p>");
                if (email_status['accepted'].length) {
                    response_message += 'and an email sent to the Paralegal';
                }
                else {
                    response_message += 'but the email was not sent.';
                }
            }
            response.status(201).send({ message: response_message, affectedRows: status.affectedRows, code: 201 });
        }
        catch (error) {
            if (error['code'] === 'ER_DUP_ENTRY') {
                response.status(400).send({ message: 'Operation Failed: The referral already exists.' });
            }
            else {
                response.status(500).send({ message: 'Operation Failed: An error occured.' });
            }
        }
    }
});
exports.iims_editReferral = functions.https.onRequest(async (request, response) => {
    lib_1._enableCORS(response);
    const payload = await lib_1._getIIMSAuthPayload(request, response);
    if (payload) {
        try {
            const { case_title, case_summary, client_name, paralegal_info, message, paralegal_id, paralegal_email, paralegal_contact, paralegal_fullname, referral_id, previous_message } = request.body;
            // console.log('referral_id:', referral_id);
            // console.log('case_id:', case_id);
            // console.log('paralegal_info:', paralegal_info);
            // console.log('client_name:', client_name);
            // console.log('case_title:', case_title);
            // console.log('case_summary:', case_summary);
            // console.log('message:', message);
            // console.log('previous_message:', previous_message);
            console.log('paralegal_contact:', paralegal_contact);
            let paralegal_info_array = [];
            if (paralegal_info !== 'default') {
                paralegal_info_array = paralegal_info.split(':');
                // console.log('paralegal_id:', paralegal_info_array[0]);
                // console.log('paralegal_email:', paralegal_info_array[1]);
                // console.log('paralegal_contact:', paralegal_info_array[2]);
                // console.log('paralegal_fullname:', paralegal_info_array[3])
            }
            const connection = await config_1._connect();
            const status = await connection.query("UPDATE iims_codebits_t_referrals"
                + " INNER JOIN iims_law_cases ON iims_law_cases.id = iims_codebits_t_referrals.case_id"
                + " SET iims_codebits_t_referrals.paralegal_id = ?,"
                + "     iims_codebits_t_referrals.referral_action_requested = ?"
                + " WHERE ((iims_codebits_t_referrals.referral_id = ?) AND"
                + "        (iims_codebits_t_referrals.referral_status_id = 1) AND "
                + "        (iims_law_cases.f_id = ?))", [(paralegal_info === 'default' ? paralegal_id : paralegal_info_array[0]), message, referral_id, payload.firm_id]);
            if (status.affectedRows === 1) {
                // Check if the data has changed
                if (paralegal_info === 'default' && previous_message === message) {
                    response.status(200).send({ message: 'Operation Successful.', affectedRows: status.affectedRows, code: 200 });
                }
                else {
                    // Push a firebase notification, email, sms Informing the previous paralegal... future update
                    // Push a firebase notification/email/sms informing the new paralegal. 
                    let response_message = 'Operation Successful: Referral updated ';
                    const firm_details = await lib_1._getFirmDetailsByFirmId(payload.firm_id);
                    if (paralegal_email) {
                        const email_status = await config_1._sendEmail(
                        // paralegal_email, 
                        'kajubimark2@gmail.com', "Case Referral " + (client_name ? 'For ' + client_name : ''), "Case Ttitle: " + case_title + ' Case Summary: ' + case_summary + ' Message: ' + message, "<h3>Dear " + paralegal_fullname + ",</h3> <p>You have received a case referral from <b>" + firm_details.name + "</b> with the following details.</p><h4 style='margin-bottom: 0px;'>Case Title </h4><p style='margin-top: 3px; font-weight: 700;'>" + case_title + "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Case Summary </h4><p style='margin-top: 3px;'>" + case_summary + "</p><h4 style='margin-bottom: 0px; margin-top: 20px;'>Requested Action </h4><p style='margin-top: 3px;'>" + message + "</p>");
                        if (email_status['accepted'].length) {
                            response_message += 'and an email sent to the New Paralegal';
                        }
                        else {
                            response_message += 'but the email was not sent.';
                        }
                    }
                    response.status(201).send({ message: response_message, affectedRows: status.affectedRows, code: 201 });
                }
            }
            else {
                response.status(400).send({ message: 'Operation Failed: The referral is already being handled by the Paralegal.', affectedRows: status.affectedRows });
            }
        }
        catch (error) {
            if (error['code'] === 'ER_DUP_ENTRY') {
                response.status(400).send({ message: 'Operation Failed: The referral already exists.' });
            }
            else if (error['code'] === 'ER_NO_REFERENCED_ROW_2') {
                response.status(400).send({ message: 'Operation Failed: Invalid data.' });
            }
            else {
                response.status(500).send({ message: 'Operation Failed: An error occured.' });
            }
        }
    }
});
exports.iims_deleteReferral = functions.https.onRequest(async (request, response) => {
    lib_1._enableCORS(response);
    const payload = await lib_1._getIIMSAuthPayload(request, response);
    if (payload) {
        try {
            const { referral_id, firm_id } = payload;
            const connection = await config_1._connect();
            const status = await connection.query("DELETE iims_codebits_t_referrals "
                + "FROM iims_codebits_t_referrals "
                + "INNER JOIN iims_law_cases ON iims_law_cases.id = iims_codebits_t_referrals.case_id "
                + "WHERE ((referral_id = ?) AND "
                + "       (iims_codebits_t_referrals.referral_status_id = 1) AND"
                + "       (iims_law_cases.f_id = ?))", [referral_id, firm_id]);
            if (status.affectedRows === 1) {
                // Inform the paralegal about the referal being deleted.
                response.status(200).send({ message: 'Operation Successful: Referral deleted.', affectedRows: status.affectedRows });
            }
            else {
                response.status(400).send({ message: 'Operation Failed: The Referral has already been deleted Or it\'s being handled by the Paralegal.', affectedRows: status.affectedRows });
            }
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.iims_getReferralDetails = functions.https.onRequest(async (request, response) => {
    lib_1._enableCORS(response);
    const payload = await lib_1._getIIMSAuthPayload(request, response);
    if (payload) {
        try {
            const { case_id, firm_id } = payload;
            const connection = await config_1._connect();
            const referrals = await connection.query("SELECT iims_codebits_t_paralegals.fullname, iims_codebits_t_paralegals.image, iims_codebits_t_paralegals.contact, iims_codebits_t_paralegals.email, iims_codebits_t_referrals.referral_action_requested, DATE_FORMAT(iims_codebits_t_referrals.referral_datetime, '%a, %b %D,%Y %h:%i %p') AS referral_datetime, iims_codebits_rt_status.status_name, DATE_FORMAT(iims_codebits_t_referrals.status_change_datetime, '%a, %b %D,%Y %h:%i %p') AS status_change_datetime, iims_codebits_t_referrals.status_change_reason FROM iims_codebits_t_referrals INNER JOIN iims_codebits_t_paralegals ON iims_codebits_t_paralegals.paralegal_id = iims_codebits_t_referrals.paralegal_id INNER JOIN iims_codebits_rt_status ON iims_codebits_rt_status.status_id = iims_codebits_t_referrals.referral_status_id INNER JOIN iims_law_cases ON iims_law_cases.id = iims_codebits_t_referrals.case_id WHERE ((iims_codebits_t_referrals.case_id = ?) AND  (iims_law_cases.f_id = ?))", [case_id, firm_id]);
            response.status(200).send({ message: 'OK', referrals, total: referrals.length });
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.iims_getCases = functions.https.onRequest(async (request, response) => {
    lib_1._enableCORS(response);
    const payload = await lib_1._getIIMSAuthPayload(request, response);
    if (payload) {
        try {
            const { firm_id } = payload;
            const connection = await config_1._connect();
            const cases = await connection.query('SELECT iims_law_cases.id, iims_law_cases.title, iims_law_client.name FROM iims_law_cases INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE iims_law_cases.f_id = ? AND iims_law_cases.case_stage != "Closed" ORDER BY iims_law_cases.title', [firm_id]);
            const paralegals = await connection.query('SELECT iims_codebits_t_paralegals.paralegal_id, iims_codebits_t_paralegals.fullname FROM iims_codebits_t_paralegals ORDER BY iims_codebits_t_paralegals.fullname');
            response.status(200).send({ message: 'OK', cases, paralegals });
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.iims_viewParalegalReferrals = functions.https.onRequest(async (request, response) => {
    lib_1._enableCORS(response);
    const payload = await lib_1._getIIMSAuthPayload(request, response);
    if (payload) {
        try {
            const { paralegal_id } = payload;
            const connection = await config_1._connect();
            const referrals = await connection.query("SELECT iims_codebits_rt_status.status_name, iims_law_cases.title, iims_law_cases.summary, iims_law_client.name, DATE_FORMAT(iims_codebits_t_referrals.referral_datetime, '%a, %b %D,%Y %h:%i %p') as referral_datetime, iims_codebits_t_referrals.referral_action_requested, DATE_FORMAT(iims_codebits_t_referrals.status_change_datetime, '%a, %b %D,%Y %h:%i %p') as status_change_datetime, iims_codebits_t_referrals.status_change_reason FROM iims_codebits_t_referrals INNER JOIN iims_codebits_rt_status ON iims_codebits_rt_status.status_id = iims_codebits_t_referrals.referral_status_id INNER JOIN iims_law_cases ON iims_law_cases.id = iims_codebits_t_referrals.case_id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE iims_codebits_t_referrals.paralegal_id = ? ORDER BY iims_law_client.name ASC", [paralegal_id]);
            response.status(200).send({ message: 'OK', referrals, total: referrals.length });
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.iims_registerParalegal = functions.https.onRequest(async (request, response) => {
    lib_1._enableCORS(response);
    const payload = await lib_1._getIIMSAuthPayload(request, response);
    if (payload) {
        try {
            const { firstname, surname, othername, contact, gender, email, village, subcounty_id, preferred_language_id, other_languages, field_of_expertise, image, date_of_birth, level_of_education, lc_1_chairperson_name, lc_1_chairperson_telephone, mosque_imam_name, mosque_imam_contact, mosque_committee_position } = request.body;
            const connection = await config_1._connect();
            // Check if the account exists.
            const result = await connection.query("SELECT paralegal_id FROM iims_codebits_t_paralegals WHERE iims_codebits_t_paralegals.email = ?", [email]);
            if (result.length) {
                response.status(403).send({ message: 'Operation Failed: Account exists' });
            }
            else {
                const password = 'defaultPassword123';
                const hashedPassword = bcrypt.hashSync(password, 10);
                // Register the paralegal
                const fullname = (gender === 'Male' ? 'Mr. ' : 'Ms. ') + firstname + ' ' + surname + ' ' + othername;
                const status = await connection.query("INSERT INTO iims_codebits_t_paralegals"
                    + "(firstname, surname, othername, email, contact, fullname, gender, image, field_of_expertise, firm_id, subcounty_id, village, preferred_language_id, other_languages, password, hashed_password, date_of_birth, chairperson_lc_1_fullname, chairperson_lc_1_contact, level_of_education, mosque_imam_name, mosque_imam_contact, mosque_committee_position)"
                    + "VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [firstname, surname, othername, email, contact, fullname, gender, image, field_of_expertise, payload.firm_id, subcounty_id, village, preferred_language_id, other_languages, password, hashedPassword, date_of_birth, lc_1_chairperson_name, lc_1_chairperson_telephone, level_of_education, mosque_imam_name, mosque_imam_contact, mosque_committee_position]);
                if (status.affectedRows === 1) {
                    response.status(201).send({ message: 'Operation Successful: Account created.' });
                }
                else {
                    response.status(500).send({ message: 'Operation Failed: Account not created.' });
                }
            }
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.iims_deleteParalegal = functions.https.onRequest(async (request, response) => {
    lib_1._enableCORS(response);
    const payload = await lib_1._getIIMSAuthPayload(request, response);
    if (payload) {
        try {
            const { paralegal_id, firm_id } = payload;
            const connection = await config_1._connect();
            const status = await connection.query("DELETE FROM iims_codebits_t_paralegals WHERE iims_codebits_t_paralegals.paralegal_id = ? AND iims_codebits_t_paralegals.firm_id = ?", [paralegal_id, firm_id]);
            if (status.affectedRows === 1) {
                response.status(200).send({ message: 'Operation Successful: Paralegal Deleted.', affectedRows: status.affectedRows });
            }
            else {
                response.status(400).send({ message: 'Operation Failed: The Paralegal has referrals attached to them.', affectedRows: status.affectedRows });
            }
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.iims_fetchParalegalAccountDetails = functions.https.onRequest(async (request, response) => {
    lib_1._enableCORS(response);
    const payload = await lib_1._getIIMSAuthPayload(request, response);
    if (payload) {
        try {
            const { paralegal_id, firm_id } = payload;
            const connection = await config_1._connect();
            const account = await connection.query("SELECT iims_codebits_t_paralegals.firstname, iims_codebits_t_paralegals.surname, iims_codebits_t_paralegals.othername, iims_codebits_t_paralegals.email, iims_codebits_t_paralegals.contact, iims_codebits_t_paralegals.image, iims_codebits_t_paralegals.field_of_expertise, iims_codebits_t_paralegals.subcounty_id, CONCAT(iims_codebits_rt_subcounties.subcounty_name, ' - ', iims_codebits_rt_districts.district_name, ' District') AS subcounty_name, iims_codebits_t_paralegals.village, iims_codebits_t_paralegals.preferred_language_id, iims_codebits_rt_languages.language_name, iims_codebits_t_paralegals.other_languages, iims_codebits_t_paralegals.gender, iims_codebits_t_paralegals.preferred_language_id, DATE_FORMAT(iims_codebits_t_paralegals.date_of_birth, '%Y-%m-%d') AS date_of_birth, iims_codebits_t_paralegals.chairperson_lc_1_fullname, iims_codebits_t_paralegals.chairperson_lc_1_contact, iims_codebits_t_paralegals.level_of_education, iims_codebits_t_paralegals.mosque_imam_name, iims_codebits_t_paralegals.mosque_imam_contact, iims_codebits_t_paralegals.mosque_committee_position FROM iims_codebits_t_paralegals INNER JOIN iims_codebits_rt_languages ON iims_codebits_rt_languages.language_id = iims_codebits_t_paralegals.preferred_language_id INNER JOIN iims_codebits_rt_subcounties ON iims_codebits_rt_subcounties.subcounty_id = iims_codebits_t_paralegals.subcounty_id INNER JOIN iims_codebits_rt_districts ON iims_codebits_rt_districts.district_id = iims_codebits_rt_subcounties.district_id WHERE iims_codebits_t_paralegals.paralegal_id = ? AND iims_codebits_t_paralegals.firm_id = ?", [paralegal_id, firm_id]);
            response.status(200).send({ message: 'OK', account: account[0] });
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
exports.iims_editParalegal = functions.https.onRequest(async (request, response) => {
    lib_1._enableCORS(response);
    const payload = await lib_1._getIIMSAuthPayload(request, response);
    if (payload) {
        try {
            const { firstname, surname, othername, contact, gender, email, village, subcounty_id, preferred_language_id, other_languages, field_of_expertise, image, date_of_birth, level_of_education, lc_1_chairperson_name, lc_1_chairperson_telephone, mosque_imam_name, mosque_imam_contact, mosque_committee_position } = request.body;
            const connection = await config_1._connect();
            const fullname = (gender === 'Male' ? 'Mr. ' : 'Ms. ') + firstname + ' ' + surname + ' ' + othername;
            const status = await connection.query("UPDATE iims_codebits_t_paralegals SET "
                + " firstname = ?,"
                + " surname = ?,"
                + " othername = ?,"
                + " email = ?,"
                + " contact = ?,"
                + " fullname = ?,"
                + " gender = ?,"
                + " image = ?,"
                + " field_of_expertise = ?,"
                + " subcounty_id = ?,"
                + " village = ?,"
                + " preferred_language_id = ?,"
                + " other_languages = ?,"
                + " chairperson_lc_1_fullname = ?,"
                + " chairperson_lc_1_contact = ?,"
                + " level_of_education = ?,"
                + " mosque_imam_name = ?,"
                + " mosque_imam_contact = ?,"
                + " mosque_committee_position = ?,"
                + " date_of_birth = ?"
                + "WHERE iims_codebits_t_paralegals.paralegal_id = ? AND iims_codebits_t_paralegals.firm_id = ?", [
                firstname, surname, othername, email, contact, fullname, gender, image, field_of_expertise,
                subcounty_id, village, preferred_language_id, other_languages, lc_1_chairperson_name,
                lc_1_chairperson_telephone, level_of_education, mosque_imam_name, mosque_imam_contact,
                mosque_committee_position, date_of_birth, payload.paralegal_id, payload.firm_id
            ]);
            if (status.affectedRows === 1) {
                response.status(200).send({ message: 'Operation Successful: Paralegal account updated.', affectedRows: status.affectedRows });
            }
            else {
                response.status(500).send({ message: 'Operation Failed: Parelagal information not updated.' });
            }
        }
        catch (error) {
            response.status(500).send({ message: 'Operation Failed: An error occured.' });
        }
    }
});
//# sourceMappingURL=index.js.map