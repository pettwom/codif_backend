/* eslint-disable no-undef */

const jwt = require('jsonwebtoken');
const SEED = process.env.SEED;

let verificaToken = async(req, res, next) => {
    let token = req.header('token');

    if (!token) {
        return res.status(401).json({
            message: '¡No existe Token!'
        })
    }
    try {
        await jwt.verify(token, SEED);
        next();     
     } catch (error) {
        console.log(error,1321);
        return res.status(401).json({
            ok:false,
            message: '¡Token no válido!'
        })
     }
};

module.exports = {
    verificaToken
}
