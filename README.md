> Should be able to modify a google sheet given a sheet id, cell name, and text

- Figure out how google identifies a sheet
  > Should be able to see a list of sheet ids?
- Figure out how google lists sheets, maybe we can have a SCS folder
  > Example of connecting to it from a seperate node server
- Can be a simple cell id input and new text input

High Level Flow:
Main usage will be
Input: Sheet id, Cell number, Text
Output/Action: Mutation of sheet

Technical Information Detailing Project Stack and other Details
Suppose the express api is called
mutateSheet(sheet_id, cell_number, text)
getSheetList()

> Check is sheet_id is valid and accessible
> Check if cell_number is valid and accessible
> text doesn't need any crazy sanitation nothing to do here for now

curl -X POST http://localhost:3000/mutate-sheet -H "Content-Type: application/json" -d '{"sheet_id":"1pm6uH4SrOXdML5qp7iatDQBrDHXQltDOzKoB448Soyc","cell_number":"Sheet1!A1","text":"hello3"}'

Sheet link: https://docs.google.com/spreadsheets/d/1pm6uH4SrOXdML5qp7iatDQBrDHXQltDOzKoB448Soyc/edit?gid=0#gid=0

Configuration details:
Make sure to add spreadsheetmutator@credible-rex-507019-k3.iam.gserviceaccount.com as editor and turn off notify

nvm setup
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

Test Documentation
GET /row-leftmost
curl -s "http://localhost:3000/row-leftmost?sheet_id=1pm6uH4SrOXdML5qp7iatDQBrDHXQltDOzKoB448Soyc&row=1&sheet_name=Sheet1"
https://docs.google.com/spreadsheets/d/1pm6uH4SrOXdML5qp7iatDQBrDHXQltDOzKoB448Soyc/edit?gid=0#gid=0
Fill first row with task1, task2, task3, task4, task5
Should get this as response:
{"ok":true,"row":1,"count":5,"data":[["A1","task1"],["B1","task2"],["C1","task3"],["D1","task4"],["E1","task5"]]}

GET /column-topmost
curl -s "http://localhost:3000/column-topmost?sheet_id=1pm6uH4SrOXdML5qp7iatDQBrDHXQltDOzKoB448Soyc&column=A&sheet_name=Sheet1"
Fill A column with task1, atomic task 1, atomic task 2, atomic task 3, atomic task 4

GET /add-to-end-of-row
curl -s "http://localhost:3000/add-to-end-of-row?sheet_id=1pm6uH4SrOXdML5qp7iatDQBrDHXQltDOzKoB448Soyc&row=1&text=hello&sheet_name=Sheet1"

GET /add-to-end-of-column
curl -s "http://localhost:3000/add-to-end-of-column?sheet_id=1pm6uH4SrOXdML5qp7iatDQBrDHXQltDOzKoB448Soyc&column=C&text=hello&sheet_name=Sheet1"

curl "http://localhost:3000/delete-column?sheet_id=1pm6uH4SrOXdML5qp7iatDQBrDHXQltDOzKoB448Soyc&column=D&sheet_name=Sheet2"

curl -X POST "http://localhost:3000/add-to-column-rightmost" -H "Content-Type: application/json" -d '{"sheet_id":"1pm6uH4SrOXdML5qp7iatDQBrDHXQltDOzKoB448Soyc","sheet_name":"Sheet2","tasks":["buy milk","call Sam","ship box"]}'

curl -s "http://localhost:3000/rightmost-column?sheet_id=1pm6uH4SrOXdML5qp7iatDQBrDHXQltDOzKoB448Soyc&sheet_name=Sheet2" | jq

curl -s "http://localhost:3000/empty-columns?sheet_id=1pm6uH4SrOXdML5qp7iatDQBrDHXQltDOzKoB448Soyc&sheet_name=Sheet1"
