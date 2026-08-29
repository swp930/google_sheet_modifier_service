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
