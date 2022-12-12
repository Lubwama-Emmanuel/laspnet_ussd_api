"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLanguages = exports.getDistricts = void 0;
const functions = require("firebase-functions");
const config_1 = require("../config");
exports.getDistricts = functions.https.onRequest(async (request, response) => {
    const connection = await config_1.connect();
    const districts = await connection.query('SELECT * FROM iims_codebits_districts');
    response.send(districts);
});
exports.getLanguages = functions.https.onRequest(async (request, response) => {
    const connection = await config_1.connect();
    const languages = await connection.query('SELECT * FROM iims_codebits_languages');
    response.send(languages);
});
//# sourceMappingURL=index.js.map