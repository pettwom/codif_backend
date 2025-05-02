/* eslint-disable no-async-promise-executor */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
"use strict";

var fs = require("fs");
var pdf = require("html-pdf");
var ejs = require("ejs");
var path = require("path");
const Promise = require("bluebird");
const QRCode = require("qrcode");

const dataImagenIne = fs.readFileSync(path.join(__dirname, "logo-ine.png"), "base64", "utf8");

const data = fs.readFileSync(path.join(__dirname, "logo.png"), "base64", "utf8");
const dataImagenIne22 = fs.readFileSync(path.join(__dirname, "logoInstitucional.png"), "base64", "utf8");
// const dataImagenCentenario = fs.readFileSync(path.join(__dirname, 'LOGO-BI.png'), 'base64', 'utf8');
const dataImagenLogoIne = fs.readFileSync(path.join(__dirname, "logo_ine_2024.png"), "base64", "utf8");
const dataImagenLogoAgro = fs.readFileSync(path.join(__dirname, "logo_2024_agro.png"), "base64", "utf8");
// const dataImagenLogoIne1 = fs.readFileSync(path.join(__dirname, 'logo_ine.png'), 'base64', 'utf8');
const dataImagenQR = fs.readFileSync(path.join(__dirname, "qr.png"), "base64", "utf8");

let options_contratos_usuarios = {
  filename: "test.pdf",
  format: "Letter",
  border: {
    top: "0cm", // defaul is 0, units: mm, cm, in, px
    bottom: "0cm",
    right: "1.5cm",
    left: "1.5cm"
  },
  header: {
    height: "4cm",
    contents: {
      default: `
            <div style ="position: relative">
                <div>
                    <img src="data:image/png;base64, ${dataImagenLogoIne} " id="base64image" alt="logo" width="120"  style="position:absolute; left: 0"/>
                    <img src="data:image/png;base64, ${dataImagenLogoAgro} " id="base64image" alt="logo" width="80" style="position:absolute; right: 0"/>
                </div>
            </div>
            `
    }
  },
  footer: {
    height: "2cm",
    contents: {
      default: `
                <div style="text-align: center; font-size: 8px; border-top: inset 2px black">
                    Oficina Central La Paz<br>
                    · Avenida José Carrasco N° 1391- Miraflores · Telf.: Piloto (591-2) 2222333 · Fax (591-2) 2222885 <br>
                    · www.ine.gob.bo · @INEOficialBO · /ineboliviaoficial · ceninf@ine.gob.bo  
                </div>
                <div style="margin-left: 510px; text-align: center; font-size: 10px">Pág.{{page}}/{{pages}}</div> 
            `
    }
  },
  base: "file:///D:"
};
let options_pagos = {
  filename: "test.pdf",
  format: "Legal",
  orientation: "portrait",
  border: {
    top: "0cm", // defaul is 0, units: mm, cm, in, px
    bottom: "0cm",
    right: "1cm",
    left: "1cm"
  },
  header: {
    height: "2.5cm",
    contents: {
      default: `
            <div style ="position: relative">
                <div>
                    <img src="data:image/png;base64, ${dataImagenLogoIne} " id="base64image" alt="logo" width="120"  style="position:absolute; left: 0"/>
                    <img src="data:image/png;base64, ${dataImagenLogoAgro} " id="base64image" alt="logo" width="80" style="position:absolute; right: 0"/>
                </div>
            </div>
            `
    }
  },
  footer: {
    height: "2cm",
    contents: {
      default: `
                <div style="text-align: center; font-size: 8px; border-top: inset 2px black">
                    Oficina Central La Paz<br>
                    · Avenida José Carrasco N° 1391- Miraflores · Telf.: Piloto (591-2) 2222333 · Fax (591-2) 2222885 <br>
                    · www.ine.gob.bo · @INEOficialBO · /ineboliviaoficial · ceninf@ine.gob.bo  
                </div>
                <div style="margin-left: 510px; text-align: center; font-size: 10px">Pág.{{page}}/{{pages}}</div> 
            `
    }
  },
  base: "file:///D:"
};
let options_actividades = {
  filename: "test.pdf",
  format: "Letter",
  border: {
    top: "0cm", // defaul is 0, units: mm, cm, in, px
    bottom: "0cm",
    right: "1.5cm",
    left: "1.5cm"
  },
  header: {
    height: "2.5cm",
    contents: {
      default: `
            <div style ="position: relative">
                <div>
                    <img src="data:image/png;base64, ${dataImagenLogoIne} " id="base64image" alt="logo" width="120"  style="position:absolute; left: 0"/>
                    <img src="data:image/png;base64, ${dataImagenLogoAgro} " id="base64image" alt="logo" width="80" style="position:absolute; right: 0"/>
                </div>
            </div>
            `
    }
  },
  footer: {
    height: "2cm",
    contents: {
      default: `
                <div style="text-align: center; font-size: 8px; border-top: inset 2px black">
                    Oficina Central La Paz<br>
                    · Avenida José Carrasco N° 1391- Miraflores · Telf.: Piloto (591-2) 2222333 · Fax (591-2) 2222885 <br>
                    · www.ine.gob.bo · @INEOficialBO · /ineboliviaoficial · ceninf@ine.gob.bo  
                </div>
                <div style="margin-left: 510px; text-align: center; font-size: 10px">Pág.{{page}}/{{pages}}</div> 
            `
    }
  },
  base: "file:///D:"
};
let options_informes = {
  filename: "test.pdf",
  format: "Letter",
  border: {
    top: "0cm", // defaul is 0, units: mm, cm, in, px
    bottom: "0cm",
    right: "1.5cm",
    left: "1.5cm"
  },
  header: {
    height: "2.5cm",
    contents: {
      default: `
            <style>
             .header-logo {
            width: 100px;
        }

        .header-form {
            width: 150px;
            font-size: 10px;
            font-family: Georgia, 'Times New Roman', Times, serif;
        }
        .header_red{
        border-collapse:collapse;
        border-spacing:0;
        }
        .header_red tr:nth-child(1) {
            background-color: #c00000;
            color: white;
            text-align: center;
            padding: 10px;
            border-radius: 5px;
            font-weight: 700;
            height: 20px;
            font-size: 10px;
            font-family: Georgia, 'Times New Roman', Times, serif;
        }

        .header_red tr:nth-child(2) {
            text-align: center;
            background-color: #f9d2b4;
            height: 15px;
            padding:3px 0px;
            font-size: 10px;
            font-family: Georgia, 'Times New Roman', Times, serif;
        }
            .formulario{
                background: rgb(250,243,242);
                background: linear-gradient(180deg, rgba(250,243,242,1) 0%, rgba(230,186,185,1) 100%);
                border: 1px solid #e6bab9;
                border-radius: 5px;
                color: #888888;
                font-size: 9px
            }
            </style> 
            <table class="header_red">
                <tr>
                    <td class="header-logo">
                        <img src="data:image/png;base64, ${dataImagenIne} " id="base64image" alt="logo"  style="position:absolute; width:49.8px; left: 8px; top:9px"/>
                    </td>
                    <td class="header-centro">INFORME DE ACTIVIDADES / SOLICITUD DE PAGO</td>
                    <td class="header-form">
                        <div class="formulario">Form. INE/DAS/ASA/06</div>
                    </td>
                </tr>
                <tr>
                    <td colspan="3">
                        FORMULARIO UNICO DE ACTIVIDADES MENSUAL Y/O FINAL PARA SERVICIOS DE CONSULTORIA DEL
                        INSTITUTO NACIONAL DE ESTADISTICA
        
                    </td>
                </tr>
            </table>
            `
    }
  },
  footer: {
    height: "2cm",
    contents: {
      default: `
                <div style="width:680px;text-align: center; font-size: 8px; border-top: inset 2px black">
                    Oficina Central La Paz<br>
                    · Avenida José Carrasco N° 1391- Miraflores · Telf.: Piloto (591-2) 2222333 · Fax (591-2) 2222885 <br>
                    · www.ine.gob.bo · @INEOficialBO · /ineboliviaoficial · ceninf@ine.gob.bo  
                </div>
                <div style="margin-left: 650px; text-align: center; font-size: 10px">Pág.{{page}}/{{pages}}</div> 
            `
    }
  },
  base: "file:///D:"
};

async function generarReporte(ruta, datos, tipoFormato = "portrait", nombreArchivo = "---") {
  /* QR */
  var ex = [];
  const opts = {
    errorCorrectionLevel: "H",
    type: "image/png",
    quality: 0.95,
    margin: 1,
    color: {
      dark: "#000000",
      light: "#FFF"
    }
  };
  let fechaObj = new Date();
  let arrayMonth = [
    "ENERO",
    "FEBRERO",
    "MARZO",
    "ABRIL",
    "MAYO",
    "JUNIO",
    "JULIO",
    "AGOSTO",
    "SEPTIEMBRE",
    "OCTUBRE",
    "NOVIEMBRE",
    "DICIEMBRE"
  ];
  let fecha = fechaObj.getDate() + " DE " + arrayMonth[fechaObj.getMonth() + 1] + " DE " + fechaObj.getFullYear();
  let cleanQr = "";
  if (datos.qr) {
    let qrImage = await QRCode.toDataURL(`http://cpvcontrataciones.ine.gob.bo/#/verificador/${datos.qr}`, opts);
    switch (ruta) {
      case "contrato_continuidad":
        cleanQr = qrImage.replace("data:image/png;base64,", "");
        break;
      default:
        break;
    }
  }

  var compiled = ejs.compile(fs.readFileSync(path.join(__dirname, "../contratos", ruta + ".html"), "utf8"));
  var html = compiled({
    ...datos,
    fecha,
    cleanQr,
    data,
    dataImagenIne,
    dataImagenLogoAgro,
    dataImagenIne22,
    dataImagenQR,
    dataImagenLogoIne,
    cantidadTotalPostulantesRequeridosLiteral: 3,
    cantidadTotalPostulantesRequeridos: "sdf",
    num_vacancia: 3,
    gestion: 2022,
    listaJustificacion: [],
    listaFunciones: [],
    listaCursos: [],
    listaDocumentosPresentar: []
  });
  let opcionesReporte;
  console.log(ruta);
  switch (ruta) {
    case "fac":
      opcionesReporte = options_actividades;
      break;
    case "requisitos":
      opcionesReporte = options_actividades;
      break;
    case "contrato_usuario":
      opcionesReporte = options_contratos_usuarios;
      break;
    case "actividades":
      opcionesReporte = options_actividades;
      break;
    case "pago1":
      opcionesReporte = options_pagos;
      break;
    case "pago2":
      opcionesReporte = options_pagos;
      break;
    case "pago1-general":
      opcionesReporte = options_pagos;
      break;
    case "pago2-general":
      opcionesReporte = options_pagos;
      break;
    case "Informe-Consultoria":
      opcionesReporte = options_informes;
      break;

    default:
      opcionesReporte = options_contratos_usuarios;
      break;
  }

  opcionesReporte.orientation = tipoFormato;

  opcionesReporte.childProcessOptions = {
    env: {
      OPENSSL_CONF: "/dev/null"
    }
  };
  // var result = `
  //     <div id="pageHeader">
  //         <table style="width: 100%;">
  //             <thead>
  //                 <tr>
  //                     <th><img src="data:image/png;base64, <%= dataImagenLogoIne %> " id="base64image" alt="logo" width="120" /></th>
  //                     <th><h4>CONTRATO DE TRABAJO</h4></th>
  //                     <th><img src="data:image/png;base64, <%= item.codigoQr %>" class="rounded mx-auto d-block" id='base64image'
  //                         height="80px"></th>
  //                 </tr>
  //             </thead>
  //         </table>
  //     </div>`;
  //     html = result +html
  return new Promise(async (resolve, reject) => {
    await pdf.create(html, opcionesReporte).toBuffer(async (err, buffer) => {
      if (err) {
        console.log("salida--->>>>>>>>>>>>>" + err);
      } else {
        // await fs.writeFileSync('./backup_documentos_generados/' + nombreArchivo + '.pdf', buffer);
        resolve(buffer.toString("base64"));
      }
    });
  });

  // opcionesReporte.orientation = tipoFormato;

  // opcionesReporte.childProcessOptions = {
  //     env: {
  //         OPENSSL_CONF: '/dev/null',
  //     },
  // };

  // return new Promise(async (resolve, reject) => {
  //     await pdf.create(html, opcionesReporte).toFile('./downloads/' + nombreArchivo, function (err, res) {
  //         if (err) return console.log(err);
  //         console.log(res); // { filename: '/app/businesscard.pdf' }
  //     });
  // });
}

function generateQrCodeAsync(data) {
  const opts = {
    text: "https://jindo.dev.naver.com/collie",
    errorCorrectionLevel: "H",
    type: "image/png",
    quality: 0.95,
    margin: 1,
    color: {
      dark: "#000000",
      light: "#FFF"
    }
  };
  return new Promise((resolve, reject) => {
    QRCode.toDataURL(data, opts)
      .then(url => {
        //let cleanQr2 = url.replace("data:image/png;base64,", "");
        resolve(url.replace("data:image/png;base64,", ""));
      })
      .catch(err => {
        reject(err);
      });
  });
}

module.exports = {
  generarReporte,
  generateQrCodeAsync
};
