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

/**
 * Column index (0-based) -> A1 column letters.
 * 0 -> A, 25 -> Z, 26 -> AA
 */
function columnIndexToLetter(index) {
    let n = index;
    let letters = '';
    while (n >= 0) {
        letters = String.fromCharCode((n % 26) + 65) + letters;
        n = Math.floor(n / 26) - 1;
    }
    return letters;
}

function isEmptyCell(value) {
    return value === undefined || value === null || String(value).trim() === '';
}

/**
 * Contiguous non-empty cells in a row, starting at the first non-empty cell from the left.
 *
 * @param {string} sheetId spreadsheet id
 * @param {number|string} row 1-based row number
 * @param {string} [sheetName='Sheet1'] tab name
 * @returns {Promise<Array<[string, string]>>} e.g. [['C5', 'foo'], ['D5', 'bar']]
 */
async function getDataForRowLeftMost(sheetId, row, sheetName = 'Sheet1') {
    if (!sheetId) throw new Error('sheet_id is required');
    if (row === undefined || row === null || row === '') throw new Error('row is required');

    const rowNumber = Number(row);
    if (!Number.isInteger(rowNumber) || rowNumber < 1) {
        throw new Error('row must be a positive integer');
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Entire row; Sheets only returns up to the last non-empty cell
    const range = `${sheetName}!${rowNumber}:${rowNumber}`;
    const result = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
        majorDimension: 'ROWS',
    });

    const values = result.data.values?.[0] || [];

    let start = 0;
    while (start < values.length && isEmptyCell(values[start])) {
        start += 1;
    }

    if (start >= values.length) return [];

    let end = start;
    while (end < values.length && !isEmptyCell(values[end])) {
        end += 1;
    }

    const tuples = [];
    for (let i = start; i < end; i += 1) {
        const cellId = `${columnIndexToLetter(i)}${rowNumber}`;
        tuples.push([cellId, String(values[i])]);
    }

    return tuples;
}

async function handleGetRowLeftMost(req, res) {
    try {
        const sheetId = req.body?.sheet_id || req.query.sheet_id;
        const row = req.body?.row ?? req.query.row;
        const sheetName = req.body?.sheet_name || req.query.sheet_name || 'Sheet1';

        const data = await getDataForRowLeftMost(sheetId, row, sheetName);

        res.json({ ok: true, row: Number(row), count: data.length, data });
    } catch (err) {
        const status = err.code === 400 || /required|must be/i.test(err.message) ? 400 : 500;
        console.error(err);
        res.status(status).json({ ok: false, error: err.message });
    }
}

function columnLetterToIndex(letter) {
    const s = String(letter).trim().toUpperCase();
    if (!/^[A-Z]+$/.test(s)) {
        throw new Error('column must be a letter like A, B, or AA');
    }
    let n = 0;
    for (let i = 0; i < s.length; i += 1) {
        n = n * 26 + (s.charCodeAt(i) - 64);
    }
    return n - 1; // 0-based
}

function normalizeColumn(column) {
    if (column === undefined || column === null || column === '') {
        throw new Error('column is required');
    }
    if (typeof column === 'number' || /^\d+$/.test(String(column))) {
        const n = Number(column);
        if (!Number.isInteger(n) || n < 1) {
            throw new Error('numeric column must be a 1-based integer');
        }
        return columnIndexToLetter(n - 1);
    }
    return String(column).trim().toUpperCase();
}

/**
 * Contiguous non-empty cells in a column, starting at the first non-empty cell from the top.
 *
 * @param {string} sheetId
 * @param {string|number} column letter ("C") or 1-based index (3)
 * @param {string} [sheetName='Sheet1']
 * @returns {Promise<Array<[string, string]>>} e.g. [['C2', 'foo'], ['C3', 'bar']]
 */
async function getDataForColumnTopMost(sheetId, column, sheetName = 'Sheet1') {
    if (!sheetId) throw new Error('sheet_id is required');

    const colLetter = normalizeColumn(column);
    columnLetterToIndex(colLetter); // validate

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const range = `${sheetName}!${colLetter}:${colLetter}`;
    const result = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
        majorDimension: 'COLUMNS',
    });

    const values = result.data.values?.[0] || [];

    let start = 0;
    while (start < values.length && isEmptyCell(values[start])) {
        start += 1;
    }

    if (start >= values.length) return [];

    let end = start;
    while (end < values.length && !isEmptyCell(values[end])) {
        end += 1;
    }

    const tuples = [];
    for (let i = start; i < end; i += 1) {
        const cellId = `${colLetter}${i + 1}`;
        tuples.push([cellId, String(values[i])]);
    }

    return tuples;
}

async function handleGetColumnTopMost(req, res) {
    try {
        const sheetId = req.body?.sheet_id || req.query.sheet_id;
        const column = req.body?.column ?? req.query.column;
        const sheetName = req.body?.sheet_name || req.query.sheet_name || 'Sheet1';

        const data = await getDataForColumnTopMost(sheetId, column, sheetName);

        res.json({ ok: true, column: normalizeColumn(column), count: data.length, data });
    } catch (err) {
        const status = err.code === 400 || /required|must be|letter/i.test(err.message) ? 400 : 500;
        console.error(err);
        res.status(status).json({ ok: false, error: err.message });
    }
}

/**
 * Append text after the last non-empty cell in a row (left → right).
 * Empty row writes to column A.
 *
 * @param {string} sheetId
 * @param {number|string} row 1-based row number
 * @param {string|number|boolean} text
 * @param {string} [sheetName='Sheet1']
 * @returns {Promise<{ cell: string, updatedRange: string, updatedCells: number }>}
 */
async function addToEndOfRow(sheetId, row, text, sheetName = 'Sheet1') {
    if (!sheetId) throw new Error('sheet_id is required');
    if (row === undefined || row === null || row === '') throw new Error('row is required');
    if (text === undefined || text === null) throw new Error('text is required');

    const rowNumber = Number(row);
    if (!Number.isInteger(rowNumber) || rowNumber < 1) {
        throw new Error('row must be a positive integer');
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const range = `${sheetName}!${rowNumber}:${rowNumber}`;
    const result = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
        majorDimension: 'ROWS',
    });

    const values = result.data.values?.[0] || [];

    let last = -1;
    for (let i = 0; i < values.length; i += 1) {
        if (!isEmptyCell(values[i])) last = i;
    }

    const targetIndex = last + 1; // next cell after last used; 0 if row empty
    const cell = `${sheetName}!${columnIndexToLetter(targetIndex)}${rowNumber}`;

    const update = await mutateSheet(sheetId, cell, text);

    return {
        cell,
        updatedRange: update.updatedRange,
        updatedCells: update.updatedCells,
    };
}

async function handleAddToEndOfRow(req, res) {
    try {
        const sheetId = req.body?.sheet_id || req.query.sheet_id;
        const row = req.body?.row ?? req.query.row;
        const text = req.body?.text ?? req.query.text;
        const sheetName = req.body?.sheet_name || req.query.sheet_name || 'Sheet1';

        const data = await addToEndOfRow(sheetId, row, text, sheetName);

        res.json({ ok: true, ...data });
    } catch (err) {
        const status = err.code === 400 || /required|must be/i.test(err.message) ? 400 : 500;
        console.error(err);
        res.status(status).json({ ok: false, error: err.message });
    }
}

/**
 * Append text after the last non-empty cell in a column (top → bottom).
 * Empty column writes to row 1.
 *
 * @param {string} sheetId
 * @param {string|number} column letter ("C") or 1-based index (3)
 * @param {string|number|boolean} text
 * @param {string} [sheetName='Sheet1']
 * @returns {Promise<{ cell: string, updatedRange: string, updatedCells: number }>}
 */
async function addToEndOfColumn(sheetId, column, text, sheetName = 'Sheet1') {
    if (!sheetId) throw new Error('sheet_id is required');
    if (text === undefined || text === null) throw new Error('text is required');

    const colLetter = normalizeColumn(column);
    columnLetterToIndex(colLetter);

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const range = `${sheetName}!${colLetter}:${colLetter}`;
    const result = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range,
        majorDimension: 'COLUMNS',
    });

    const values = result.data.values?.[0] || [];

    let last = -1;
    for (let i = 0; i < values.length; i += 1) {
        if (!isEmptyCell(values[i])) last = i;
    }

    const targetRow = last + 2; // last is 0-based; next row is last+2
    const cell = `${sheetName}!${colLetter}${targetRow}`;

    const update = await mutateSheet(sheetId, cell, text);

    return {
        cell,
        updatedRange: update.updatedRange,
        updatedCells: update.updatedCells,
    };
}

async function handleAddToEndOfColumn(req, res) {
    try {
        const sheetId = req.body?.sheet_id || req.query.sheet_id;
        const column = req.body?.column ?? req.query.column;
        const text = req.body?.text ?? req.query.text;
        const sheetName = req.body?.sheet_name || req.query.sheet_name || 'Sheet1';

        const data = await addToEndOfColumn(sheetId, column, text, sheetName);

        res.json({ ok: true, ...data });
    } catch (err) {
        const status = err.code === 400 || /required|must be|letter/i.test(err.message) ? 400 : 500;
        console.error(err);
        res.status(status).json({ ok: false, error: err.message });
    }
}

app.post('/add-to-end-of-column', handleAddToEndOfColumn);
app.get('/add-to-end-of-column', handleAddToEndOfColumn);

app.post('/add-to-end-of-row', handleAddToEndOfRow);
app.get('/add-to-end-of-row', handleAddToEndOfRow);

app.post('/column-topmost', handleGetColumnTopMost);
app.get('/column-topmost', handleGetColumnTopMost);

app.post('/row-leftmost', handleGetRowLeftMost);
app.get('/row-leftmost', handleGetRowLeftMost);

app.post('/mutate-sheet', handleMutate);
app.get('/mutate-sheet', handleMutate);

app.listen(PORT, () => {
    console.log(`Sheets mutate API listening on http://localhost:${PORT}`);
});