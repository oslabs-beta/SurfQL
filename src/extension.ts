/* eslint-disable curly */
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { type } from 'os';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import parser from "./parser";
import { offerSuggestions, parseDocumentQuery, fixBadHistoryFormatting,
	historyToObject, isolateCursor, getSuggestions } from "./lib/suggestions";
import { Schema, QueryEntry } from './lib/models';

let schema: Schema;
let queryEntry: QueryEntry;
let schemaPaths: string[] = [];
let enumArr: Array<any> = [];
let enumObj: any = {};

let disposable: vscode.Disposable;

// This function will only be executed when the extension is activated.
export async function activate(context: vscode.ExtensionContext) {
	displayConfigPrompt();
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
						const [objectArr, queryMutation, enumArr, inputArr, scalarArr] = parser(schemaText);
						schema = arrToObj(objectArr);
						queryEntry = arrToObj(queryMutation);
						panel.webview.postMessage({
							command: "sendSchemaInfo",
							text: JSON.stringify([objectArr, queryMutation, enumArr, inputArr, scalarArr]),
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
		// - Create TypeScript types for all these functions

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
			displayConfigPrompt(); // Prompt the user
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
	const [objectArr, queryMutation, enumArr, inputArr, scalarArr] = parser(schemaText);
	const queryEntry = arrToObj(queryMutation);
	const schemaObject = arrToObj(objectArr);
	// const usableSchemaObj = createNestedObj(schemaObj);
	return [queryEntry, schemaObject, [schemaPath], enumArr];
}

function displayConfigPrompt(): void {
	vscode.window.showInformationMessage("No SurfQL config found. Would you like to generate one for this workspace?", 'Generate', 'Okay', 'Don\'t show again').then((userChoice) => {
		if (userChoice === undefined) {
			console.log('Create schema prompt dismissed');
			return;
		} else {
			console.log({userChoice});
			if (userChoice === 'Generate') {
				console.log('Generating a config file...');
			} else if (userChoice === 'Don\'t show again') {
				console.log('Disabling this popup');
			}
		}
	});
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

