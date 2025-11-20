import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Compatibility for CommonJS modules within ES Module scope
const require = createRequire(import.meta.url);
const Afip = require('@afipsdk/afip.js');
const { v4: uuidv4 } = require('uuid');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;

// Aumentar límite de tamaño para recibir certificados grandes en el body
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

/**
 * Mapeo de datos del Frontend a códigos de AFIP
 */
const mapInvoiceType = (type) => {
    switch (type) {
        case 'Factura A': return 1;
        case 'Factura B': return 6;
        case 'Factura C': return 11;
        default: return 11;
    }
};

const mapConceptType = (concept) => {
    switch (concept) {
        case 'Productos': return 1;
        case 'Servicios': return 2;
        case 'Productos y Servicios': return 3;
        default: return 1;
    }
};

/**
 * ENDPOINT PRINCIPAL: CREAR FACTURA
 */
app.post('/api/create-invoice', async (req, res) => {
    let tempCertPath = null;
    let tempKeyPath = null;

    try {
        const { auth, invoice } = req.body;

        if (!auth || !auth.cuit || !auth.cert || !auth.key) {
            throw new Error("Faltan credenciales (CUIT, Certificado o Llave) en la petición.");
        }

        console.log(`🔄 Procesando petición para CUIT: ${auth.cuit}`);

        // Usar os.tmpdir() para compatibilidad con la nube (Render/Heroku)
        const uniqueId = uuidv4();
        const tempDir = os.tmpdir();
        
        tempCertPath = path.join(tempDir, `cert_${uniqueId}.crt`);
        tempKeyPath = path.join(tempDir, `key_${uniqueId}.key`);

        // Escribir los archivos en disco
        fs.writeFileSync(tempCertPath, auth.cert);
        fs.writeFileSync(tempKeyPath, auth.key);

        // Inicializar instancia de AFIP
        const afip = new Afip({
            CUIT: parseInt(auth.cuit),
            cert: tempCertPath,
            key: tempKeyPath,
            production: true 
        });

        const cbteTipo = mapInvoiceType(invoice.type);
        const concepto = mapConceptType(invoice.concept);
        const puntoVenta = invoice.posNumber || 1; 

        // Obtener último comprobante
        const lastVoucher = await afip.ElectronicBilling.getLastVoucher(puntoVenta, cbteTipo);
        const nextVoucher = lastVoucher + 1;
        
        // Calcular total
        const totalAmount = invoice.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
        
        const formattedDate = parseInt(new Date().toISOString().slice(0,10).replace(/-/g, '')); 

        let data = {
            'CantReg': 1,
            'PtoVta': puntoVenta,
            'CbteTipo': cbteTipo,
            'Concepto': concepto,
            'DocTipo': 99, 
            'DocNro': 0,   
            'CbteDesde': nextVoucher,
            'CbteHasta': nextVoucher,
            'CbteFch': formattedDate,
            'ImpTotal': totalAmount,
            'ImpTotConc': 0,
            'ImpNeto': totalAmount,
            'ImpOpEx': 0,
            'ImpIVA': 0,
            'ImpTrib': 0,
            'MonId': 'PES',
            'MonCotiz': 1,
        };

        if (concepto === 2 || concepto === 3) {
            data.FchServDesde = formattedDate;
            data.FchServHasta = formattedDate;
            data.FchVtoPago = formattedDate;
        }

        const response = await afip.ElectronicBilling.createVoucher(data);
        console.log("✅ Comprobante creado con éxito:", response.CAE);

        res.json({
            success: true,
            cae: response.CAE,
            vto: response.CAEFchVto,
            voucherNumber: nextVoucher
        });

    } catch (error) {
        console.error("❌ Error:", error.message);
        res.status(500).json({
            success: false,
            message: error.message || "Error interno del servidor"
        });
    } finally {
        // Limpieza
        try {
            if (tempCertPath && fs.existsSync(tempCertPath)) fs.unlinkSync(tempCertPath);
            if (tempKeyPath && fs.existsSync(tempKeyPath)) fs.unlinkSync(tempKeyPath);
        } catch (cleanupErr) {
            console.error("Error limpiando:", cleanupErr);
        }
    }
});

app.get('/', (req, res) => {
    res.send('FacturIA Backend is running');
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Backend running on port ${port}`);
});