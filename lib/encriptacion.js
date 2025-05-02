const CryptoJS = require("crypto-js");
const { encriptacion } = require('../config');

function encriptar (dato) {
    // Encrypt

    var ciphertext = CryptoJS.AES.encrypt(JSON.stringify(dato), encriptacion.secret).toString();
    return ciphertext.replace(/\+/g,'p1L2u3S').replace(/\//g,'s1L2a3S4h').replace(/=/g,'e1Q2u3A4l');
}

function desencriptar (datoEncriptado) {
    // Decrypt
    var bytes  = CryptoJS.AES.decrypt(datoEncriptado.replace(/p1L2u3S/g, '+' ).replace(/s1L2a3S4h/g, '/').replace(/e1Q2u3A4l/g, '='), encriptacion.secret);
    try {
        var decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        return decryptedData;    
    } catch (exceptionVar) {
        throw new Error("El dato encriptado no coincide con lo que genera el sistema");
    }

}

module.exports = {
    encriptar,
    desencriptar
}

/*
U2FsdGVkX1/dTeVC4JQRPLtYP9mdUHQfb1PPn9GrP9Y=
U2FsdGVkX1/BQU52B86nBUElzGZwKYY5CMe6Z6MVkqE=
U2FsdGVkX19rJ8bZ2LFfwzIgba83E5QqbOGAVHBN0HY=
U2FsdGVkX19NFNAkJ5vXQXQpi63D1mHye7U0HLdK5jE=
U2FsdGVkX18uB4MfZV2ZDwRleey+O0a7tpsUp+uWjgs=
*/