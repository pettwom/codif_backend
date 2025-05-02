/* eslint-disable no-undef */
const puppeteer = require('puppeteer');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

// Función para generar el código QR
async function generateQRCode(url) {
    const qrOptions = {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.95,
        margin: 1,
        color: {
            dark: '#000000',
            light: '#FFF'
        }
    };
    
    const qrCodeBase64 = await QRCode.toDataURL(url, qrOptions);
    return qrCodeBase64;
}

// Función para generar el PDF con el contenido dinámico
async function generatePdf() {
    // Ruta de la imagen (puedes cargarla desde el sistema de archivos o usar base64)
    const imagePath = path.join(__dirname, 'logo.png');
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString('base64');

    // Generar el código QR con una URL
    const qrCodeBase64 = await generateQRCode('http://miurl.com');

    // Cargar y renderizar la plantilla EJS
    const templatePath = path.join(__dirname, 'template.ejs');
    const html = await ejs.renderFile(templatePath, { 
        imageBase64: imageBase64, 
        qrCodeBase64: qrCodeBase64 
    });

    // Usar Puppeteer para generar el PDF con encabezado, contenido y pie de página
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Generar el PDF
    await page.pdf({
        path: path.join(__dirname, 'agropecuario2025.pdf'),
        format: 'A4',
        printBackground: true,
        margin: { top: '80px', right: '10px', bottom: '40px', left: '10px' },
        displayHeaderFooter: true,
        headerTemplate: `
            <div style="width: 100%; text-align: center;">
                <img src="data:image/png;base64,<%= imageBase64 %>" alt="Logo" width="100" />
            </div>`,
        footerTemplate: `
            <div style="width: 100%; text-align: center; font-size: 12px;">
                <div>© 2024 Mi Empresa - Todos los derechos reservados.</div>
                <div>Pág. {{page}}/{{pages}}</div>
            </div>`,
    });

    await browser.close();
    console.log('PDF generado con éxito');
}

// Llamada a la función principal
generatePdf().catch(console.error);