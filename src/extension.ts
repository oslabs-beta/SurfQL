/* eslint-disable curly */
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { type } from 'os';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import parser from "./parser";
import { offerSuggestions, parseDocumentQuery,
	fixBadHistoryFormatting } from "./lib/suggestions";
import { Schema, QueryEntry } from './lib/models';

let schema: Schema;
let queryEntry: QueryEntry;
let schemaPaths: string[] = [];
let enumArr: Array<any> = [];
let enumObj: any = {};

let disposable: vscode.Disposable;

// This function will only be executed when the extension is activated.
export async function activate(context: vscode.ExtensionContext) {
	// At startup
  console.log('SurfQL is now active 🌊');
	[ queryEntry, schema, schemaPaths, enumArr ] = await configToSchema(); // Parse schema files from the config file
	console.log('schema', schema);
	console.log('queryEntry', queryEntry);
	enumObj = enumToObj(enumArr);

  // Creates a popup with a schema tree visualizer.
  const previewSchema = vscode.commands.registerCommand(
    "surfql.previewSchema",
    async () => {
			// If no schema path was found from a config file: Open a file selector
			if (schemaPaths.length === 0) {
				// Prompt user to select a schema file.
				const options: vscode.OpenDialogOptions = {
					canSelectMany: false,
					openLabel: "Open",
					filters: {
						"graphqlsFiles": ["graphql", "graphqls", "ts", "js"],
					},
				};

				// Update the schema path.
				await vscode.window.showOpenDialog(options).then((fileUri) => {
					console.log("file Uri -> ", fileUri);
					if (fileUri && fileUri[0]) {
						schemaPaths = [fileUri[0].fsPath];
					}
				});
			}
			for (const schemaPath of schemaPaths) {
				//create a new panel in webView
				const panel = vscode.window.createWebviewPanel(
					"Preview Schema", // viewType, internal use
					"Schema Preview", // Preview title in the tag
					vscode.ViewColumn.Beside, // where the new panel shows
					{
						enableScripts: true,
					} //option to add scripts
				);

				// Get path to the preview.js script on disk
				const onDiskPath = vscode.Uri.file(
					path.join(context.extensionPath, "scripts", "preview.js")
				);

				//toDo add stylesheet.
				const styleSheetPath = vscode.Uri.file(
					path.join(context.extensionPath, "stylesheet", "preview.css")
				);

				const logoPath = vscode.Uri.file(
					path.join(context.extensionPath, "media", "icon.svg")
				);

				//add the previewjs to panel as a accessible Uri
				const scriptSrc = panel.webview.asWebviewUri(onDiskPath);
				const styleSrc = panel.webview.asWebviewUri(styleSheetPath);
				const logoScr = panel.webview.asWebviewUri(logoPath);

				//Add html content//
				panel.webview.html = getWebViewContent(
					scriptSrc.toString(),
					styleSrc.toString(),
					logoScr.toString()
      			);

				//add event listener to webview
				panel.webview.onDidReceiveMessage((message) => {
					if (message.command === "get schema text") {
						let schemaText = fs.readFileSync(schemaPath, "utf8");
						const [objectArr, queryMutation, enumArr, inputArr] = parser(schemaText);
						schema = arrToObj(objectArr);
						queryEntry = arrToObj(queryMutation);
						panel.webview.postMessage({
							command: "sendSchemaInfo",
							text: JSON.stringify([objectArr, queryMutation, enumArr, inputArr]),
						});
					}
					console.log('the schema is', schema);
					return;
				});
			}
    }
	
  );

  context.subscriptions.push(previewSchema);

	const hoverProvider: vscode.Disposable = vscode.languages.registerHoverProvider(
		'javascript', 
		{
        	provideHover(document, position, token) {
				const range = document.getWordRangeAtPosition(position);
				const word = document.getText(range);
				if (enumObj[word]) {
					return new vscode.Hover({
						language: "graphQL",
						value: `Enum Type, Choose from ${JSON.stringify(enumObj[word])}`
					});
				}
			}
		}
    );
	context.subscriptions.push(hoverProvider);

	// EVENT: On every document change: ...
	vscode.workspace.onDidChangeTextDocument((e) => {
		// Exit early when no schema has been loaded.
		if (!schema) {
			console.log('Ignoring updates: No schema loaded');
			return;
		}

		const cursorY: number = e.contentChanges[0].range.start.line; // Line number
		const cursorX: number = e.contentChanges[0].range.start.character; // Column
		// Trying to test what data can inform us in how to format the auto complete
		// - Add a new line (before and after) (and indent) or not?
		console.log('\n\nrow', cursorY, 'column', cursorX);
		console.log('Current line:', e.document.lineAt(cursorY).text);
		console.log('Changes:', e.contentChanges.map(x => x.text));
		console.log('Change had new line:', e.contentChanges[0].text.includes('\n'));

		// Parse the document's current query into an array.
		const messyHistoryArray = parseDocumentQuery(cursorY, cursorX, e.document);
		console.log('Original history array:', messyHistoryArray);
		// Stimulate spacing around brackets/parentheses for easier parsing.
		const formattedHistoryArray: string[] = fixBadHistoryFormatting(messyHistoryArray);
		console.log('Formatted history array:', formattedHistoryArray);
		// Parse history array into an object.
		const historyObject = historyToObject(formattedHistoryArray);
		console.log('COMPLETE SCHEMA:', historyObject);
		// Clean up the history object.
		historyObject.typedSchema = isolateCursor(historyObject.typedSchema);
		console.log('ISOLATED SCHEMA:', historyObject);
		// Create suggestions based off of the history and schema.
		const suggestions = getSuggestions(historyObject, schema, queryEntry);
		console.log('SUGGESTIONS:', suggestions);
		
		// Dispose of the old suggestion.
		if (disposable) disposable.dispose();
		// Create the CompletionItems.
		disposable = vscode.languages.registerCompletionItemProvider(
			'javascript',
			{
				provideCompletionItems() {		
					return offerSuggestions(suggestions) as vscode.CompletionItem[];
				}
			},
			'\n'
		);
		// Subscribe them to be popped up as suggestions.
		context.subscriptions.push(disposable);

		// TODO:
		// - Add cursor detection within args to auto suggest args instead of fields

		/**
		 * Converts a history array to a history object.
		 * @param historyArray Any array of strings representing a valid query
		 * @returns A nested object that resembles the document's query
		 */
		function historyToObject(historyArray: string[]) {
			const historyObj: any = { typedSchema: {} };
			let newHistory = [...historyArray];
			
			// Determine the operator.
			if (newHistory[0].toLowerCase() === 'query' || newHistory[0] === '{') {
				historyObj.operator = 'query';
			} else if (newHistory[0].toLowerCase() === 'mutation') {
				historyObj.operator = 'mutation';
			} else {
				console.log('Throwing error: Invalid query format');
				throw new Error('Invalid query format');
			}

			// Determine if there are outter arguments (always the case for valid mutations).
			if ((historyObj.operator === 'mutation') || (newHistory[0].toLowerCase() === 'query' && newHistory[2] === '(')) {
				const {inners, outters} = collapse(newHistory, '(', ')');
				newHistory = outters;
				historyObj.typedSchema._args = parseArgs(inners);
			}

			// Recursively nest into the typed schema to build out the historyObj.
			traverseHistory(collapse(newHistory, '{', '}').inners, historyObj.typedSchema, historyObj);

			// Return the history object that was constructed from the history array.
			return historyObj;
		}

		/**
		 * Takes in an array, removing everything between the first set of opening
		 * and closing characters. The enclosed area (inners) and surrounding area
		 * (outters) are returned as well as the modification count (skipped).
		 * @param arr Any array of strings (history array)
		 * @param openingChar Any character: '{', '(', etc...
		 * @param closingChar Any character: '}', ')', etc...
		 * @returns {inners, outters, skipped}
		 */
		function collapse(arr: string[], openingChar: string, closingChar: string) {
			const outters: string[] = []; // The contents outside the opening/closing chars
			const inners: string[] = []; // The contents within the opening/closing chars
			let state: number = 0; // 0 when outside (outters); >= 1 when inside (inners)
			let skipped: number = 0; // Tracks how many words were added to inners
			let initialized: boolean = false; // Helps determine when the encapsulation is finished
			let finished: boolean = false; // When finished the rest of the words are added to outters
			for (const word of arr) {
				if (finished) {
					// Checking to see if the encapsulation (collapse) has finished.
					outters.push(word); // When collapse is finished add the rest to outters
				} else if (word === openingChar) {
					// Checking to see if the current word matches the opening char.
					initialized = true; // Initialize search (may repeat which is okay)
					if (state) inners.push(word); // If this is nested within the encapsulation then include it in the inners
					state++; // Increment the state: We are nested 1 level deeper now
					skipped++; // Increment the skipped count
				} else if (word === closingChar) {
					// Checking to see if the current word matches the closing char.
					state--; // Decrement the state: We are 1 level less nested now
					if (state) inners.push(word); // If this is nested within the encapsulation then include it in the inners
					skipped++; // Increment the skipped count
					if (initialized && state <= 0) finished = true; // Check for completion
				} else {
					// Otherwise add the current word to its respective array.
					if (state) {
						inners.push(word);
						skipped++;
					} else {
						outters.push(word);
					}
				}
			}
			return { outters, inners, skipped };
		}

		/**
		 * Parses an array of strings into an object with argument data.
		 * @param inners Inners captured from the collapse() method integrate well
		 * @returns An object resembling key/value pairs of Apollo GraphQL arguments
		 */
		function parseArgs(inners: string[]) {
			// TODO: Convert any type from a string to its intended type for type testing
			// - Example: "3" -> 3 (number)
			// - Example: "[1," "2," "3]" -> [1, 2, 3] (array/nested)
			// - Example: "{" "int:" "3" "}" -> {int: 3} (object/nested)
			// - etc...
			const args: any = {};
			// Iterate through the argument inners.
			for (let i = 0; i < inners.length; i++) {
				// Declare the current and next values for convenience.
				const current: string = inners[i];
				const next: string = inners[i + 1];
				// The current key/value involves an object.
				if (next === '{') {
					// Leverage 'skipped' from collapse() to ignore the object details.
					const { skipped } = collapse(inners.slice(i), '{', '}');
					i += skipped;
					args[current.slice(0, -1)] = {}; // Assign an empty object as a indicator
				}
				// The current key/value does not involve an object.
				else {
					// Slice off the ':' and add the key/value pair to obj
					args[current.slice(0, -1)] = next.replace(/,$/, ''); // Also ignore trailing commas
					i++; // Increment i an extra time here to move to the next 2 key/values.
				}
			}
			return args;
		}
		
		/**
		 * Traverses a history array to recursively build out the object array.
		 * @param historyRef The current section of history that needs to be parsed
		 * @param obj The portion of the history object that is being built
		 * @param entireHistoryObj The entire history object used to reference root-level properties
		 */
		function traverseHistory(historyRef: string[], obj: any, entireHistoryObj: any): void {		
			// Do not mutate the original history to keep this function pure.
			let history: string[] = [...historyRef];

			// Check to see what follows the field to see what type it is (nested?)
			for (let i = 0; i < history.length; i++) {
				let current = history[i];
				let next = history[i + 1];
				let newObj: string | any = {};

				// The current word is just a message that this cursor is at this level.
				if (current === '🐭') {
					entireHistoryObj.cursor = obj; // TODO: Remove this? Quick access to the cursor object has never been leveraged.
					obj._cursor = true; // ⭐️ Signify that the cursor was found at this level
					continue; // Increment i and iterate the loop
				}

				obj[current] = newObj;  // Default to expect a nested field

				// Check for arguments:
				if (next === '(') {
					const { inners, skipped } = collapse(history.slice(i), '(', ')');
					const args = parseArgs(inners); // Parse the arguments
					newObj._args = args; // Assign the arguments to the new object
					i += skipped; // Skip the rest of the argument inners
					current = history[i]; // Reassign 'current' for the following if block
					next = history[i + 1]; // Reassign 'next' for the following if block
				}
				// Check for a bracket signifying a nested field:
				if (next === '{') {
					const { inners, skipped } = collapse(history.slice(i), '{', '}');
					// Skip what was found within the nested field and continue to process
					// other fields at this level.
					i += skipped;
					// Recurse to process the nested field that was skipped.
					traverseHistory(inners, newObj, entireHistoryObj);
				}
				// If the field was not nested: Add the scalar's property.
				else {
					obj[current] = 'Scalar';
				}
			}
		}

		function isolateCursor(history) {
			// Make sure to pass in the obj.typedSchema
			// Break case: the cursor is found
			if (history._cursor) {
				// Flattens other side paths
				return Object.entries(history).reduce((obj, [key, value]) => {
					if (typeof value === 'object') obj[key] = 'Field';
					else if (key === '_cursor') obj[key] = true;
					else obj[key] = 'Scalar';
					return obj;
				}, {});
			}
			// Recurse case: Nest until the cursor is found
			for (const field in history) {
				if (typeof history[field] === 'object') {
					const traverse = isolateCursor(history[field]);
					if (traverse) return { [field]: traverse }; // TODO: Remove parens?
				}
			}
		}

		function getSuggestions(history, schema, queryEntry) {
			console.log({schema, queryEntry});
			// Get the right casing for the operator
			for (const entry in queryEntry) {
				if (entry.toLowerCase() === history.operator) {
					history.operator = entry;
					break;
				}
			}

			// Break early when there is no anchor point
			const entryPoint = queryEntry[history.operator];
			if (!entryPoint) {
				console.log('Invalid entry - breaking');
				return {};
			}

			// If the cursor is still within the outter-most level then return
			// suggestions for that.
			const typedHistory = history.typedSchema;
			if (typedHistory._cursor) {
				console.log('Found suggestions at ROOT');
				const suggestions = filterOutUsedFields(typedHistory, entryPoint);
				console.log({suggestions});
				return suggestions;
			}

			// Break early when there is no more history
			const nestedHistory = Object.keys(typedHistory)[0];
			if (!nestedHistory) {
				console.log('Reached end of history at root');
				return {};
			}

			// Traverse
			const returnType = entryPoint[nestedHistory].returnType;
			return traverseSchema(typedHistory[nestedHistory], schema, returnType);
		}

		function traverseSchema(history, schema, returnType) {
			console.log('Traversing:', returnType);
			// Break early: End of history/schema
			if (!history || !returnType) {
				console.log('Hit end of history/schema');
				return {};
			}

			// If the cursor depth was found
			if (history._cursor) {
				console.log('Found suggestions in traverse');
				return filterOutUsedFields(history, schema[returnType]);
			}

			// Break early when there is no more history
			const nestedHistory = Object.keys(history)[0];
			if (!nestedHistory) {
				console.log('Reached end of history within traverse');
				return {};
			}

			// Otherwise traverse to find the fields at the cursor
			const nestedReturnType = schema[returnType][nestedHistory].returnType;
			return traverseSchema(history[nestedHistory], schema, nestedReturnType);
		}

		function filterOutUsedFields(history, schema) {
			console.log('filterOutUsedFields:', {history, schema});
			const options = {};
			const historyFields = Object.keys(history);
			// Look through all the possible fields at this level.
			for (const [key, value] of Object.entries(schema)) {
				// If the schema field hasn't been typed yet:
				const valueWithType: any = value;
				if (!historyFields.includes(key)) {
					// Add it as a suggestion.
					options[key] = {
						arguments: valueWithType.arguments,
						returnType: valueWithType.returnType
					};
				}
			}
			console.log('filterOutUsedFields:', options);
			return options;
		}

		// Provide suggestions
		// function:
			// const currentSchemaBranch = traverseSchema(schema, history);
				// Update traverseSchema to check for incomplete last branch (ex: nam...)
		
		//FUNCTIONALITY

		// return suggestion and dispose?
		// Is there a better way to suggest something without subscribing? (a one-time suggest function)

		//pokemon -> type -> ele..... [pokemon, type, ele]
		//compare against schema
		// if last word typed == "name" ...na ... string[0],string[1] == name
		// create a new suggestion item that contains the full word name
		// if currentSchemaBranch[electric, fire] .... fi
		
	});
};



//Initial preview html content
const getWebViewContent = (scriptSrc: String, styleSrc: String, logoSrc: String) => {
  return `<!DOCTYPE html>
				<html lang="en">
					<head>
						<meta charset="UTF-8">
						<meta name="viewport" content="width=device-width, initial-scale=1.0">
						<title>PreviewSchema</title>
						
						<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-Zenh87qX5JnK2Jl0vWa8Ck2rdkQ2Bzep5IDxbcnCeuOxjzrPF/et3URy9Bv1WTRi" crossorigin="anonymous">
						<link rel="stylesheet" href="${styleSrc}">
						<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-OERcA2EqjJCMA+/3y+gxIOqMEjwtxJY7qPCqsdltbNJuaOe923+mo//f6V8Qbsw3" crossorigin="anonymous"></script>
						<script type="text/javascript" src="${scriptSrc}"></script>
						<style>
							body {background-color: rgb(40, 40, 40); color: rgb(240, 240, 240)}
						</style>
					</head>
					<body>
						<script>
							var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
							var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
								return new bootstrap.Tooltip(tooltipTriggerEl);
							});
						</script>
						<div class='d-flex justify-content-around align-items-center'>
							<img src="${logoSrc}" alt="#" width="40" height="40">
							<h2>Schema Hierarchy</h2>
							<button type="button" id='refresh' class="btn btn-secondary" style='color: #5fefd0'>Refresh</button>
						</div>
						<div id='board'></div>
					</body>
				</html>`;
};

// this method is called when your extension is deactivated
export function deactivate() {}

//modify the returned schemaObj
function enumToObj(arr: Array<any> | null) {
    //loop through obj, for all valueObj, check if valueObj.key exist in obj.
    //if so, valueObj.key = obj.key, then call modifyObj on valueObj
	const enumObj = {};
    arr.forEach(e => {
		enumObj[e.name] = e.value;
	})
    return enumObj;
};

function arrToObj(arr: Array<any>) {
	const result: any = {};
	arr.forEach(el => {
		result[el.name] = el.fields;
	});
	return result;
}

/**
 * Searches the root directory of the user's workspace for a schema config file.
 * The config file is used to locate the correct schema files to parse.
 */
async function configToSchema(): Promise<[any, any, string[], Array<any>]> {
	// Attempt to file the SurfQL config file within the user's workspace.
	const filepath: string | undefined = await vscode.workspace.findFiles('**/surfql.json', '**/node_modules/**', 1).then(([ uri ]: vscode.Uri[]) => {
		// When no file was found:
		if (!uri) {
			createSchemaPrompt(); // Prompt the user
			return; // Return undefined
		}
		// When a config file was found return the file path.
		console.log('config path ->', uri.path);
		return uri.path;
	});

	// Exit early when there is was no SurfQL config file found.
	if (!filepath) {
		console.log('No config file found at extension startup');
		return [undefined, undefined, [], []]; // Return nothing
	}

	// Parse the config file to determine where the schema file(s) are.
	const configText = fs.readFileSync(filepath, "utf8");
	const config = JSON.parse(configText);
	const schemaPath = path.join(filepath, '../', config.schema);

	// Read the schema file and parse it into a usable object.
	const schemaText = fs.readFileSync(schemaPath, "utf8");
	const [objectArr, queryMutation, enumArr, inputArr] = parser(schemaText);
	const queryEntry = arrToObj(queryMutation);
	const schemaObject = arrToObj(objectArr);
	// const usableSchemaObj = createNestedObj(schemaObj);
	return [queryEntry, schemaObject, [schemaPath], enumArr];
}

function createSchemaPrompt(): void {
	vscode.window.showInformationMessage("No surfql.json found");
	// TODO: Add a message with an "Okay" button that will auto-generate a config
	//       file for the user (if they press "Okay").
	// TODO: The file created will be loaded with { "schema": "./your-file-here/graphql" }
}

//Out-of-scope features pre-presentation
// Live-share compatibility (usability)
// ability to detect ONLY graphql query vs parsing the whole document (efficiency)
// splash site 
// vscode publication
// check to see if the cursor is even within a query
// When the suggestion is another nested object show brackets. But when its an endpoint don't show brackets.

