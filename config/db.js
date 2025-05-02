/* eslint-disable no-undef */

const { Pool } = require("pg");

const con = new Pool({
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
});
const con_mon = new Pool({
    database: process.env.DB_DATABASE_MON,
    user: process.env.DB_USER_MON,
    password: process.env.DB_PASSWORD_MON,
    host: process.env.DB_HOST_MON,
    port: process.env.DB_PORT_MON,
});
const conMoodle = new Pool({
    database: process.env.DB_DATABASE_MOODLE,
    user: process.env.DB_USER_MOODLE,
    password: process.env.DB_PASSWORD_MOODLE,
    host: process.env.DB_HOST_MOODLE,
    port: process.env.DB_PORT_MOODLE,
});

const baseUrl = process.env.DB_BASE;

module.exports = {con, conMoodle, baseUrl,con_mon };
