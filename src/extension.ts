/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { type } from 'os';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import parser from "./parser";
import { offerSuggestions, suggestOptions, parseQuery,
	fixBadFormatting, ignoreParentheses, filterNestedPaths,
	filterFlatPaths, updateHistory, traverseSchema } from "./lib/suggestions";
import { Schema, QueryEntry } from './lib/models';

let schema: Schema;
let queryEntry: QueryEntry;
let schemaPaths: string[] = [];
let enumArr: Array<any> = [];
let enumObj: any = {};

let history: string[] = [];
let suggestions: vscode.Disposable[] = [];

// This function will only be executed when the extension is activated.
export async function activate(context: vscode.ExtensionContext) {
	// At startup
  console.log('SurfQL is now active 🌊');
	[ queryEntry, schema, schemaPaths, enumArr ] = await configToSchema(); // Parse schema files from the config file
	console.log('schema', schema);
	console.log('queryEntry', queryEntry);
	enumObj = enumToObj(enumArr);


  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand("surfql.helloWorld", () => {
    // Display a message box to the user
    vscode.window.showInformationMessage("Hello World from SurfQL!");
  });

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

				//add the previewjs to panel as a accessible Uri
				const scriptSrc = panel.webview.asWebviewUri(onDiskPath);
				const styleSrc = panel.webview.asWebviewUri(styleSheetPath);

				//Add html content//
				panel.webview.html = getWebViewContent(
					scriptSrc.toString(),
					styleSrc.toString()
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

////////////////////////
//Suggestion Provider//
///////////////////////
	// Each provider is a set of rules, for what needs to be typed, to create suggestions
	// Providers are similar to event listeners
	// const suggestionProvider: vscode.Disposable = vscode.languages.registerCompletionItemProvider(
	// 	'javascript',
	// 	{
	// 		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {		
	// 			const options = suggestOptions(schema, queryEntry, history);
	// 			return offerSuggestions(options) as vscode.CompletionItem[];
	// 		}
	// 	},
	// 	...triggerCharacters // => ['{']
	// );

	// context.subscriptions.push(suggestionProvider);

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

		// Create a query detector function here
		const messyHistory = parseQuery(cursorY, cursorX, e.document); // Parse the document into an array
		const formattedHistory: string[] = fixBadFormatting(messyHistory); // Stimulate spacing around brackets/parentheses

		// New - Delete old suggestions
		

		// New - Create suggestions
		const historyObject = historyToObject(formattedHistory);
		console.log('COMPLETE SCHEMA:', historyObject);
		historyObject.typedSchema = isolateCursor(historyObject.typedSchema);
		console.log('ISOLATED SCHEMA:', historyObject);
		const options = getSuggestions(historyObject, schema, queryEntry);
		console.log('SUGGESTIONS:', options);
		
		// Create the CompletionItems
		suggestions.forEach(disposable => disposable.dispose()); // Dispose of the old suggestions
		suggestions = [];
		suggestions.push(vscode.languages.registerCompletionItemProvider(
			'javascript',
			{
				provideCompletionItems() {		
					return offerSuggestions(options) as vscode.CompletionItem[];
				}
			},
			'\n'
		));
		// Subscribe them to be suggestions
		context.subscriptions.push(...suggestions);

		// Old
		// const cleanHistory: string[] = ignoreParentheses(formattedHistory); // Ignore the parentheses and their contents
		// const cleanerHistory: string[] = filterNestedPaths(cleanHistory); // Ignore nested objects that invalidate the path
		// const validHistory: string[] = filterFlatPaths(cleanerHistory); // Ignore properties that aren't part of the history
		// history = updateHistory(validHistory);

		// New logic for object-based history:
		function historyToObject(formattedHistory) {
			console.log({formattedHistory});
			const obj: any = { typedSchema: {} };
			let newHistory = [...formattedHistory];
			
			// Determine the operator
			if (formattedHistory[0].toLowerCase() === 'query' || formattedHistory[0] === '{') {
				obj.operator = 'query';
			} else if (formattedHistory[0].toLowerCase() === 'mutation') {
				obj.operator = 'mutation';
			} else {
				console.log('Throwing error');
				throw new Error('Invalid query format');
			}

			// Determine if there are outter arguments (always the case for valid mutations)
			if ((obj.operator === 'mutation') || (formattedHistory[0].toLowerCase() === 'query' && formattedHistory[2] === '(')) {
				const {inners, outters} = collapse(formattedHistory, '(', ')');
				newHistory = outters;
				obj.typedSchema._args = parseArgs(inners);
				// TODO REMOVE LOG: console.log('Final args:', obj.typedSchema._args);
			}

			console.log({newHistory});
			traverseHistory(collapse(newHistory, '{', '}').inners, obj.typedSchema, obj);
			return obj;
		}

		// Collapse ( -> ) or { -> }
		function collapse(arr, openingChar, closingChar) {
			const outters = [];
			const inners = [];
			let initialized = false;
			let finished = false;
			let state = 0; // 0 when outside, >= 1 when inside
			let skipped = 0;
			for (const word of arr) {
				if (finished) {
					outters.push(word);
				} else if (word === openingChar) {
					// Initialize search / Increment state
					initialized = true;
					if (state) inners.push(word);
					state++;
					skipped++;
				} else if (word === closingChar) {
					// Decrement state
					state--;
					if (state) inners.push(word);
					skipped++;
					// Check for completion
					if (initialized && state <= 0) finished = true;
				} else {
					// Add to respective array
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

		function parseArgs(inners: string[]) {
			// TODO: Convert any type from a string to its intended type for type testing
			// - Example: "3" -> 3 (number)
			// - Example: "[1," "2," "3]" -> [1, 2, 3] (array/nested)
			// - Example: "{" "int:" "3" "}" -> {int: 3} (object/nested)
			// - etc...
			// TODO REMOVE LOG: console.log('Parsing args');
			const obj: any = {};
			for (let i = 0; i < inners.length; i++) {
				// Starting off
				const current = inners[i];
				const next = inners[i + 1];
				// TODO REMOVE LOG: console.log({current, next});
				// We're dealing with an object
				if (next === '{') {
					// Leverage 'skipped' from collapse()
					const { skipped } = collapse(inners.slice(i), '{', '}');
					i += skipped;
					obj[current.slice(0, -1)] = {};
				}
				// We're not dealing with an object
				else {
					// Slice off the ':' and add the key/value pair to obj
					obj[current.slice(0, -1)] = next;
					i++;
				}
			}
			console.log('Done parsing args');
			return obj;
		}

		function traverseHistory(historyRef, obj, schema) {
			// There may be:
				// a nested field
					// There may be:
						// params
					// There will be:
						// '{'
						// Recurse
				// a non-nested field
				
			// Do not mutate the original history
			// TODO: Maybe it's fine to mutate it directly? Test this.
			let history = [...historyRef];
			// TODO REMOVE LOG: console.log('Traversing history', history);
			// Check to see what follows the field to see what type it is (nested?)
			for (let i = 0; i < history.length; i++) {
				let current = history[i];
				let next = history[i + 1];
				let newObj: string | any = { _field: current };

				// Handle cursor
				if (current === '🐭') {
					schema.cursor = obj;
					obj._cursor = true;
					continue;
				}

				obj[current] = newObj;  // Default to expect a nested field
				// TODO REMOVE LOG: console.log({current, next});
				// A scalar will be handled automatically by the for-loop incrementor.
				// Check for a nested field.
				if (next === '(') {
					// TODO REMOVE LOG: console.log('Found arguments');
					const { inners, skipped } = collapse(history.slice(i), '(', ')');
					const args = parseArgs(inners);
					newObj._args = args;
					i += skipped;
					current = history[i];
					next = history[i + 1];
					// TODO REMOVE LOG: console.log('New current:', current);
					// TODO REMOVE LOG: console.log('New next:', next);
				}
				if (next === '{') {
					// TODO REMOVE LOG: console.log('Handling nested field');
					// Try removing the i++ if this doesn't work.
					// I was trying to stimulate the loop increment but maybe its bad...
					// i++;
					const { inners, skipped } = collapse(history.slice(i), '{', '}');
					i += skipped;
					traverseHistory(inners, newObj, schema);
				}
				// Add the scalar's property
				else {
					obj[current] = 'Scalar';
				}
			}
			// TODO REMOVE LOG: console.log('Done traversing history');
		}

		function isolateCursor(history) {
			// Make sure to pass in the obj.typedSchema
			// Break case: the cursor is found
			if (history._cursor) {
				// TODO REMOVE LOG: console.log('End point:', history);
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
				// TODO REMOVE LOG: console.log('FIELD', field);
				if (typeof history[field] === 'object') {
					// TODO REMOVE LOG: console.log('Nesting into', field);
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
const getWebViewContent = (scriptSrc: String, styleSrc: String) => {
  return `<!DOCTYPE html>
				<html lang="en">
					<head>
						<meta charset="UTF-8">
						<meta name="viewport" content="width=device-width, initial-scale=1.0">
						<title>PreviewSchema</title>
						<script type="text/javascript" src="${scriptSrc}"></script>
						<link rel="stylesheet" href="${styleSrc}" />
					</head>
					<body>
						<h1>Schema Hierarchy</h1>
						<button id='refresh' type='button'>Refresh</button>
						<div id='board'></div>
						<script>
							document.addEventListener('DOMcontentLoaded', () => {
								const vscode = acquireVsCodeApi();
								function getSchematext() {
									vscode.postMessage({
										command: 'get schema text'
									})
								}
								getSchematext();
							})
						</script>
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

