require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const PORT = process.env.PORT || 3000;
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const app = express();
app.use(cors());
app.use(express.json());

function getAuth() {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        return new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            scopes: SCOPES,
        });
    }

    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        return new google.auth.JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: SCOPES,
        });
    }

    throw new Error(
        'Missing Google credentials. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY.'
    );
}

/**
 * Write text into a single Google Sheets cell.
 * @param {string} sheetId
 * @param {string} cellNumber A1 notation, e.g. "A1" or "Sheet1!B2"
 * @param {string|number|boolean} text
 */
async function mutateSheet(sheetId, cellNumber, text) {
    if (!sheetId) throw new Error('sheet_id is required');
    if (!cellNumber) throw new Error('cell_number is required');
    if (text === undefined || text === null) throw new Error('text is required');

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const result = await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: cellNumber,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[text]],
        },
    });

    return result.data;
}

app.get('/health', (_req, res) => {
    res.json({ ok: true });
});

async function handleMutate(req, res) {
    try {
        const sheetId = req.body?.sheet_id || req.query.sheet_id;
        const cellNumber = req.body?.cell_number || req.query.cell_number;
        const text = req.body?.text ?? req.query.text;

        const data = await mutateSheet(sheetId, cellNumber, text);

        res.json({
            ok: true,
            spreadsheetId: data.spreadsheetId,
            updatedRange: data.updatedRange,
            updatedCells: data.updatedCells,
        });
    } catch (err) {
        const status = err.code === 400 || /required/i.test(err.message) ? 400 : 500;
        console.error(err);
        res.status(status).json({ ok: false, error: err.message });
    }
}

app.post('/mutate-sheet', handleMutate);
app.get('/mutate-sheet', handleMutate);

app.listen(PORT, () => {
    console.log(`Sheets mutate API listening on http://localhost:${PORT}`);
});