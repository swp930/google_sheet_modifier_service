import logo from './logo.svg';
import './App.css';

function App() {
  const modifySpreadsheet = async () => {
    console.log("Modify spreadsheet")
    await mutateSheet(
      '1pm6uH4SrOXdML5qp7iatDQBrDHXQltDOzKoB448Soyc',
      'Sheet1!A1',
      'hello5'
    );
  }

  async function mutateSheet(sheetId, cellNumber, text) {
    const res = await fetch('http://localhost:3000/mutate-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheet_id: sheetId,
        cell_number: cellNumber,
        text,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Request failed: ${res.status}`);
    }
    return data;
  }

  return (
    <div className="App">
      <button onClick={modifySpreadsheet}>Modify spreadsheet</button>
    </div>
  );
}

export default App;
