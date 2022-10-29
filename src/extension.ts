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
	filterFlatPaths, updateHistory } from "./lib/suggestions";
import { Schema, QueryEntry } from './lib/models';

let schema: Schema;
let queryEntry: QueryEntry;
let schemaPaths: string[] = [];
let enumArr: Array<any> = [];
let enumObj: any = {};

let history: string[] = [];
const triggerCharacters: string[] = ['{'];

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
	const suggestionProvider: vscode.Disposable = vscode.languages.registerCompletionItemProvider(
		'javascript',
		{
			provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {		
				const options = suggestOptions(schema, queryEntry, history);
				return offerSuggestions(options) as vscode.CompletionItem[];
			}
		},
		...triggerCharacters // => ['{']
	);

	context.subscriptions.push(suggestionProvider);

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

		// name .... na...[na,] -> {
		const lineNumber: number = e.contentChanges[0].range.start.line;
		const characterNumber: number = e.contentChanges[0].range.start.character;
		const line: string = e.document.lineAt(lineNumber).text;
		console.log('\n\nrow', lineNumber, 'column', characterNumber);

		// Create a query detector function here

		const messyHistory: string[] = parseQuery(lineNumber, characterNumber, e.document); // Parse the document into an array
		const formattedHistory: string[] = fixBadFormatting(messyHistory); // Stimulate spacing around brackets/parentheses
		const cleanHistory: string[] = ignoreParentheses(formattedHistory); // Ignore the parentheses and their contents
		const cleanerHistory: string[] = filterNestedPaths(cleanHistory); // Ignore nested objects that invalidate the path
		const validHistory: string[] = filterFlatPaths(cleanerHistory); // Ignore properties that aren't part of the history
		history = updateHistory(validHistory);

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
						
						<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-Zenh87qX5JnK2Jl0vWa8Ck2rdkQ2Bzep5IDxbcnCeuOxjzrPF/et3URy9Bv1WTRi" crossorigin="anonymous">
						<link rel="stylesheet" href="${styleSrc}">
						<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-OERcA2EqjJCMA+/3y+gxIOqMEjwtxJY7qPCqsdltbNJuaOe923+mo//f6V8Qbsw3" crossorigin="anonymous"></script>
						<script type="text/javascript" src="${scriptSrc}"></script>
						<style>
							body {background-color: rgb(40, 40, 40); color: rgb(240, 240, 240)}
						</style>
					</head>
					<body>
						<h2>Schema Hierarchy</h2>
						<button type="button" id='refresh' class="btn btn-secondary">Refresh</button>
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

