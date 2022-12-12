"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports._enableCORS = exports._login = exports._getFirmDetailsByFirmId = exports._getCaseDetailsByCaseId = exports._getParalegalNotificationToken = exports._countParalegalClosedCases = exports._countParalegalOpenCases = exports._countParalegalReferrals = exports._updateCaseReferrals = exports._getIIMSAuthPayload = exports._getAuthPayload = void 0;
const config_1 = require("./config");
const bcrypt = require('bcryptjs');
exports._getAuthPayload = (request, response) => {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    let payload = null;
    if (token === undefined) {
        response.status(403).send({ message: 'Token is missing' });
    }
    else {
        payload = config_1._verifyToken(token);
        if (payload === undefined) {
            response.status(401).send({ message: 'Token is invalid' });
        }
    }
    return payload;
};
exports._getIIMSAuthPayload = async (request, response) => {
    let payload = request.query;
    if (payload === undefined || payload.session_id === 'undefined' || payload.firm_id === 'undefined') {
        response.status(403).send({ message: 'Session is missing' });
    }
    else {
        const connection = await config_1._connect();
        const status = await connection.query('SELECT COUNT(iims_session.session_id) AS Count FROM iims_session WHERE iims_session.session_id = ?', [payload.session_id]);
        if (parseInt(status[0]['Count']) === 0) {
            payload = null;
        }
    }
    return payload;
};
exports._updateCaseReferrals = async (case_id) => {
    let successFull = false;
    try {
        const connection = await config_1._connect();
        let status = await connection.query("SELECT iims_codebits_t_referrals.referral_id FROM iims_codebits_t_referrals WHERE (iims_codebits_t_referrals.case_id = ?) AND (iims_codebits_t_referrals.referral_status_id = 1)", [case_id]);
        status.filter(async (referral) => {
            status = await connection.query("UPDATE iims_codebits_t_referrals SET iims_codebits_t_referrals.referral_status_id = 4 WHERE (iims_codebits_t_referrals.referral_id = ?)", [referral['referral_id']]);
        });
        successFull = true;
    }
    catch (error) {
        successFull = false;
    }
    return successFull;
};
exports._countParalegalReferrals = async (paralegal_id) => {
    let count = 0;
    try {
        const connection = await config_1._connect();
        const status = await connection.query("SELECT COUNT(paralegal_id) AS Count FROM iims_codebits_t_referrals WHERE paralegal_id = ? AND referral_status_id = 1", [paralegal_id]);
        count = status[0]['Count'];
    }
    catch (error) {
        count = 0;
    }
    return count;
};
exports._countParalegalOpenCases = async (paralegal_id) => {
    let count = 0;
    try {
        const connection = await config_1._connect();
        const status = await connection.query("SELECT DISTINCT COUNT(iims_law_client.name) AS Count FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2) AND (iims_law_cases.case_stage != 'Closed') ORDER BY iims_law_client.name ASC", [paralegal_id]);
        count = status[0]['Count'];
    }
    catch (error) {
        count = 0;
    }
    return count;
};
exports._countParalegalClosedCases = async (paralegal_id) => {
    let count = 0;
    try {
        const connection = await config_1._connect();
        const status = await connection.query("SELECT DISTINCT COUNT(iims_law_client.name) AS Count FROM iims_law_cases INNER JOIN iims_codebits_t_referrals ON iims_codebits_t_referrals.case_id = iims_law_cases.id INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id WHERE (iims_codebits_t_referrals.paralegal_id = ?) AND  (iims_codebits_t_referrals.referral_status_id = 2) AND (iims_law_cases.case_stage = 'Closed') ORDER BY iims_law_client.name ASC", [paralegal_id]);
        count = status[0]['Count'];
    }
    catch (error) {
        count = 0;
    }
    return count;
};
exports._getParalegalNotificationToken = async (paralegal_id) => {
    let notifications_token = null;
    try {
        const connection = await config_1._connect();
        const results = await connection.query("SELECT iims_codebits_t_paralegals.notifications_token FROM iims_codebits_t_paralegals WHERE iims_codebits_t_paralegals.paralegal_id = ?", [paralegal_id]);
        notifications_token = results[0].notifications_token;
    }
    catch (error) {
        notifications_token = null;
    }
    return notifications_token;
};
exports._getCaseDetailsByCaseId = async (case_id) => {
    let details;
    try {
        const connection = await config_1._connect();
        const results = await connection.query("SELECT iims_law_firms.name AS lasps, iims_law_client.name AS client_name, iims_law_cases.title AS case_title, iims_law_cases.summary AS case_summary FROM iims_law_cases INNER JOIN iims_law_client ON iims_law_client.id = iims_law_cases.client_id INNER JOIN iims_law_firms ON iims_law_firms.firm_id = iims_law_cases.f_id WHERE iims_law_cases.id = ?", [case_id]);
        details = {
            lasps: results[0]['lasps'],
            client_name: results[0]['client_name'],
            case_title: results[0]['case_title'],
            case_summary: results[0]['case_summary'],
        };
    }
    catch (error) {
        details = null;
    }
    return details;
};
exports._getFirmDetailsByFirmId = async (firm_id) => {
    let details;
    try {
        const connection = await config_1._connect();
        const results = await connection.query("SELECT iims_law_firms.name, iims_law_firms.address, iims_law_firms.phone_number, iims_law_firms.email FROM iims_law_firms WHERE (iims_law_firms.firm_id = ?)", [firm_id]);
        details = {
            name: results[0]['name'],
            address: results[0]['address'],
            phone_number: results[0]['phone_number'],
            email: results[0]['email'],
        };
    }
    catch (error) {
        details = null;
    }
    return details;
};
exports._login = async (email, password, remember_me) => {
    let payload;
    try {
        const connection = await config_1._connect();
        const result = await connection.query("SELECT COUNT(iims_codebits_t_paralegals.hashed_password) AS Count, iims_codebits_t_paralegals.contact, iims_codebits_t_paralegals.village, iims_codebits_t_paralegals.field_of_expertise, iims_codebits_t_paralegals.image, iims_codebits_t_paralegals.fullname, iims_codebits_t_paralegals.hashed_password, iims_codebits_t_paralegals.firm_id, iims_codebits_t_paralegals.paralegal_id, iims_codebits_t_paralegals.firstname, iims_codebits_t_paralegals.surname, iims_codebits_t_paralegals.othername, iims_codebits_t_paralegals.preferred_language_id, iims_codebits_t_paralegals.other_languages, iims_codebits_t_paralegals.gender, iims_codebits_t_paralegals.subcounty_id, iims_codebits_t_paralegals.date_of_birth, iims_codebits_t_paralegals.chairperson_lc_1_fullname, iims_codebits_t_paralegals.chairperson_lc_1_contact, iims_codebits_t_paralegals.mosque_imam_name, iims_codebits_t_paralegals.mosque_imam_contact, iims_codebits_t_paralegals.mosque_committee_position, iims_codebits_t_paralegals.level_of_education FROM iims_codebits_t_paralegals WHERE (iims_codebits_t_paralegals.email = ?)", [email]);
        const passwordIsValid = bcrypt.compareSync(password, result[0]['hashed_password']);
        if (result[0]['Count'] === '1' && passwordIsValid) {
            const tokenPayload = await config_1._generateToken(result[0]['paralegal_id'], result[0]['firm_id'], remember_me);
            payload = {
                token: tokenPayload.token,
                exp: tokenPayload.exp,
                user: {
                    email: email,
                    name: result[0]['fullname'],
                    image: result[0]['image'],
                    address: result[0]['physical_address'],
                    contact: result[0]['contact'],
                    field_of_expertise: result[0]['field_of_expertise'],
                    firm_id: result[0]['firm_id'],
                    firstname: result[0]['firstname'],
                    surname: result[0]['surname'],
                    othername: result[0]['othername'],
                    preferred_language_id: result[0]['preferred_language_id'],
                    other_languages: result[0]['other_languages'],
                    gender: result[0]['gender'],
                    date_of_birth: result[0]['date_of_birth'],
                    level_of_education: result[0]['level_of_education'],
                    subcounty_id: result[0]['subcounty_id'],
                    village: result[0]['village'],
                    lc_1_chairperson_name: result[0]['chairperson_lc_1_fullname'],
                    lc_1_chairperson_contact: result[0]['chairperson_lc_1_contact'],
                    mosque_imam_name: result[0]['mosque_imam_name'],
                    mosque_imam_contact: result[0]['mosque_imam_contact'],
                    mosque_committee_position: result[0]['mosque_committee_position'],
                    referrals: await exports._countParalegalReferrals(result[0]['paralegal_id']),
                    open_cases: await exports._countParalegalOpenCases(result[0]['paralegal_id']),
                    closed_cases: await exports._countParalegalClosedCases(result[0]['paralegal_id'])
                }
            };
        }
    }
    catch (error) {
        payload = null;
        payload.token = 'error:' + error;
    }
    return payload;
};
exports._enableCORS = (response) => {
    response.set('Access-Control-Allow-Origin', "*");
    response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
};
//# sourceMappingURL=lib.js.map