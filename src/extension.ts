/* eslint-disable curly */
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { type } from 'os';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import parser from "./parser";
import {
	offerSuggestions, parseDocumentQuery, fixBadHistoryFormatting,
	historyToObject, isolateCursor, getSuggestions,
	detectDelete, isolatedArraysFromObject
} from "./lib/suggestions";
import { configToSchema, generateConfigFile } from './lib/config';
import { Schema, QueryEntry } from './lib/models';
import { supportedSuggestionFileTypeIds, supportedSchemaParserFileTypes } from './constants';

let schema: Schema;
let queryEntry: QueryEntry;
let schemaPaths: string[] = [];
let enumArr: Array<any> = [];
let enumObj: any = {};
const webViewPanels: vscode.WebviewPanel[] = [];

let disposable: vscode.Disposable;
const showSchemaLoaded = statusMessageLimiter("Schema loaded");

// This function will only be executed when the extension is activated.
export async function activate(context: vscode.ExtensionContext) {
	// At startup
  console.log('SurfQL is now active 🌊');

	// Parse schema files that are referenced in the config file.
	const configResult = await configToSchema();
	if (configResult) { // If it didn't error out in the process then assign the global values
		[ queryEntry, schema, schemaPaths, enumArr ] = configResult;
		enumObj = enumToObj(enumArr);
		
		// Display that the schema has been loaded.
		showSchemaLoaded("Schema loaded");
	}

	// Automatically generate a config file template.
	const configCommand = vscode.commands.registerCommand(
		'surfql.generateConfigFile',
		generateConfigFile
	);

  // Creates a popup with a schema tree visualizer.
  const previewSchemaCommand = vscode.commands.registerCommand(
    "surfql.previewSchema",
    async () => {
			// If no schema path was found from a config file: Open a file selector
			if (schemaPaths.length === 0) {
				// Prompt user to select a schema file.
				const options: vscode.OpenDialogOptions = {
					canSelectMany: false,
					openLabel: "Open",
					filters: {
						"graphqlsFiles": supportedSchemaParserFileTypes,
					},
				};

				// Update the schema path.
				await vscode.window.showOpenDialog(options).then((fileUri) => {
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
					path.join(context.extensionPath, "media", "icon.png")
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

				// Add event listener to the webview panel
				panel.webview.onDidReceiveMessage((message) => {
					// Load the schema structure into the visualizer
					if (message.command === "get schema text") {
						let schemaText = fs.readFileSync(schemaPath, "utf8");
						const [objectArr, queryMutation, enumArr, inputArr, scalarArr, unionArr] = parser(schemaText);
						schema = arrToObj(objectArr);
						queryEntry = arrToObj(queryMutation);
						panel.webview.postMessage({
							command: "sendSchemaInfo",
							text: JSON.stringify([objectArr, queryMutation, enumArr, inputArr, scalarArr, unionArr]),
						});
						
						// Display that the schema has been loaded.
						showSchemaLoaded("Schema loaded");
					}
					return;
				});

				// Push the panel to the array of panels
				webViewPanels.push(panel);
			}
    }
  );
	
	// Register command functionality to the user's VS Code application.
  context.subscriptions.push(previewSchemaCommand, configCommand);

	const hoverProvider: vscode.Disposable = vscode.languages.registerHoverProvider(
		supportedSuggestionFileTypeIds, 
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

	/**
	 * Event listener logic to respond to document changes
	 */
	vscode.workspace.onDidChangeTextDocument((e) => {
		// Exit early when no schema has been loaded.
		if (!schema) {
			console.log('Ignoring text events: No schema loaded');
			return;
		}
		const activeEditor = vscode.window.activeTextEditor;
		// Exit early when no editor is active.
		if (!activeEditor) {
			console.log('Ignoring text events: No text editor open');
			return;
		}

		// Dispose of the old suggestion.
		if (disposable) disposable.dispose();

		const cursorPosition = activeEditor.selection.active;
		const cursorY: number = cursorPosition.line;
		let cursorX: number = cursorPosition.character;
		const currLine: string = e.document.lineAt(cursorY).text;

		// Fixes the cursor position with backspaces
		if (detectDelete(e)) cursorX -= 2;

		// Parse the document's current query into an array.
		const messyHistoryArray: string[] = parseDocumentQuery(cursorY, cursorX, e.document);
		// console.log('Original history array:', messyHistoryArray);
		// Stimulate spacing around brackets/parentheses for easier parsing.
		const formattedHistoryArray: string[] = fixBadHistoryFormatting(messyHistoryArray);
		// console.log('Formatted history array:', formattedHistoryArray);
		// Parse history array into an object.
		const historyObject = historyToObject(formattedHistoryArray);
		// console.log('COMPLETE SCHEMA:', historyObject);
		// Clean up the history object.
		historyObject.typedSchema = isolateCursor(historyObject.typedSchema);
		// console.log('ISOLATED SCHEMA:', historyObject);
		// Create suggestions based off of the history and schema.
		const suggestions = getSuggestions(historyObject, schema, queryEntry);
		// console.log('SUGGESTIONS:', suggestions);
		
		// Create the CompletionItems.
		disposable = vscode.languages.registerCompletionItemProvider(
			supportedSuggestionFileTypeIds,
			{
				provideCompletionItems() {		
					return offerSuggestions(suggestions, currLine) as vscode.CompletionItem[];
				}
			},
			'\n'
		);
		// Subscribe them to be popped up as suggestions.
		context.subscriptions.push(disposable);

		// Update the visualizer to follow the current schema.
		const historyData = isolatedArraysFromObject(historyObject) as [string[], string[]];
		for (const panel of webViewPanels) {
			panel.webview.postMessage({
				command: 'followCode',
				text: JSON.stringify(historyData)
			});
		}

		// TODO:
		// - Clean up this file (move functions to separate files)!
		// - Establish a linter (air bnb?)
		// - Add cursor detection within args to auto suggest args instead of fields
		// - Create TypeScript types for all these functions

	});

	/**
	 * Event listener logic to reprocess the schema parser upon config file updates
	 */
	const configUpdateListener = vscode.workspace.onDidSaveTextDocument((document) => {
		vscode.workspace.findFiles('**/surfql.config.json', '**/node_modules/**', 1).then(async ([ uri ]: vscode.Uri[]) => {
			// Exit early when no config file was found.
			if (!uri) return;
			// Because the config file was updated - the schema should be reprocessed
			// and the global state should be updated.
			if (document.fileName === uri.fsPath) {
				// Parse schema files that are referenced in the config file.
				const configResult = await configToSchema();
				if (configResult) { // If it didn't error out in the process then assign the global values
					[ queryEntry, schema, schemaPaths, enumArr ] = configResult;
					enumObj = enumToObj(enumArr);

					// Display that the schema has been loaded.
					showSchemaLoaded("Schema loaded");
				}
			}
		});
	});
	context.subscriptions.push(configUpdateListener);
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
							<button type="button" id='follow-code' class="btn btn-outline-secondary" style='color: #919da8'>Track</button>
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
	});
    return enumObj;
};

export function arrToObj(arr: Array<any>) {
	const result: any = {};
	arr.forEach(el => {
		result[el.name] = el.fields;
	});
	return result;
}

/**
 * A higher order function that prevents the same status bar item from being shown multiple times
 * @param message The message to be displayed in the status bar at the bottom of the VSCode window
 * @param duration The duration in milliseconds for which the status bar item should be shown
 * @returns A function that will show the status bar item if it's not already shown
 */
function statusMessageLimiter(message: string, duration: number = 5000): Function {
	// Create a new status bar item
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

	// Set the text of the status bar item
	statusBarItem.text = message;

	let isStatusBarItemShown = false;
	
	// Only show the status bar item if it's not already shown
  return (): void => {
    if (!isStatusBarItemShown) {
      // Show the status bar item
      statusBarItem.show();
      isStatusBarItemShown = true;

      // Hide the status bar item after the specified timeout
      setTimeout(() => {
        statusBarItem.hide();
        isStatusBarItemShown = false;
      }, duration);
    }
  };
}
