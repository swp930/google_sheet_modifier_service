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

Configuration details:
Make sure to add spreadsheetmutator@credible-rex-507019-k3.iam.gserviceaccount.com as editor and turn off notify
