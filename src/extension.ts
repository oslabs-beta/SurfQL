/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { type } from 'os';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import parser from "./parser";
import { offerSuggestions, traverseSchema, parseQuery,
	fixBadFormatting, ignoreParentheses, filterNestedPaths,
	filterFlatPaths, updateHistory, autoCompleteAnywhere } from "./lib/suggestions";

let schema: any;
let schemaPaths: string[] = [];
let providers: vscode.Disposable[] = [];

let history: any[] = [];
const triggerCharacters: string[] = ['`', '{'];

// This function will only be executed when the extension is activated.
export async function activate(context: vscode.ExtensionContext) {
	// At startup
  console.log('SurfQL is now active 🌊');
	[ schema, schemaPaths ] = await configToSchema(); // Parse schema files from the config file

	
  // Creates a popup with a schema tree visualizer.
  // The commandId parameter must match the command field in package.json
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
						"graphqls files": ["graphql", "graphqls", "ts", "js"],
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

				console.log("on disk path", onDiskPath);
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
					console.log("message1", message);
					if (message.command === "get schema text") {
						let schemaText = fs.readFileSync(schemaPath, "utf8");
						const [schemaArr, returnObj] = parser(schemaText);
						console.log(returnObj);
						schema = createNestedObj(returnObj);
						panel.webview.postMessage({
							command: "sendSchemaInfo",
							text: JSON.stringify(schemaArr),
						});
					}
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
				// Removed to enable multi-line query auto-fill
				// TODO: Break early when it can be determined that the cursor is not within a query string
				// if (!linePrefix.includes("`")) {
				// 	return undefined;
				// }

				// Need to code for instances with `query` before actual query
				/* const QUERY_ALL_USERS = gql`
  					query GetAllUsers {
    				users {
     				 id
						name
						age
						username
						nationality
						}
					}
					`;
				*/
				const currentSchemaBranch = traverseSchema(schema, history);
				//makesuggestion()
				return offerSuggestions(currentSchemaBranch) as vscode.CompletionItem[];
			}
		},
		...triggerCharacters // => ['{', '`']
	);

	// context.subscriptions.push(suggestionProvider);


	vscode.workspace.onDidChangeTextDocument((e) => {
		// Exit early when no schema has been loaded.
		if (!schema) {
			console.log('Ignoring updates: No schema loaded');
			return;
		}
		resetTemporaryProviders();

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
		// autoCompleteAnywhere(schema, history);
		const temporaryProvider: vscode.Disposable = vscode.languages.registerCompletionItemProvider(
		'javascript',
			{
				provideCompletionItems() {
					return autoCompleteAnywhere(schema, history);
				}
			},
			'\n', '\r'
		);
		addTemporaryProvider(temporaryProvider);
	});

	function addTemporaryProvider(provider: vscode.Disposable): void {
		providers.push(provider);
		context.subscriptions.push(provider);
	}

	function resetTemporaryProviders(): void {
		for (const provider of providers) {
			provider.dispose();
		}
		providers = [];
	}
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
						<div id='board'>Build a Nice Tree Structure</div>
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
function createNestedObj(obj: any) {
    //loop through obj, for all valueObj, check if valueObj.key exist in obj.
    //if so, valueObj.key = obj.key, then call modifyObj on valueObj
    for (const key in obj) {
        for (const valueKey in obj[key]) {
            if (obj[key][valueKey] in obj) {
                obj[key][valueKey] = obj[obj[key][valueKey]];
                createNestedObj(obj[key]);
            }
        }
    };
    return obj;
}

/**
 * Searches the root directory of the user's workspace for a schema config file.
 * The config file is used to locate the correct schema files to parse.
 */
async function configToSchema(): Promise<[any, string[]]> {
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
		return [undefined, []]; // Return nothing
	}

	// Parse the config file to determine where the schema file(s) are.
	const configText = fs.readFileSync(filepath, "utf8");
	const config = JSON.parse(configText);
	const schemaPath = path.join(filepath, '../', config.schema);

	// Read the schema file and parse it into a usable object.
	const schemaText = fs.readFileSync(schemaPath, "utf8");
	const [, schemaObj] = parser(schemaText);
	const usableSchemaObj = createNestedObj(schemaObj);
	return [usableSchemaObj, [schemaPath]];
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

