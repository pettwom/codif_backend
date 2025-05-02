'use strict';

require('dotenv').config();

const db = {
  // URL: process.env.URL,
  // baseDN: process.env.baseDN,
  // usernameAccess: process.env.usernameAccess,
  // password: process.env.password
  url: "ldap://10.1.0.39",
  baseDN: "DC=ine,DC=gov,DC=bo",
  usernameAccess: "authcnpv@ine.gov.bo",
  password: "G4rfunk3l"
  
};

module.exports = db;