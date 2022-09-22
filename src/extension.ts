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
	filterFlatPaths, updateHistory } from "./lib/suggestions";

let schema: any = {
	'Import a schema file...': 0
};

let history: any[] = [];
const triggerCharacters: string[] = ['`', '{'];
const indentation = '  '; // TODO: Update based off the config (spacing/tab amount)

export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('SurfQL is now active 🌊');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand("surfql.helloWorld", () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    vscode.window.showInformationMessage("Hello World from SurfQL!");
  });

  //let's do a popup for preview Schema
  let previewSchema = vscode.commands.registerCommand(
    "surfql.previewSchema",
    async () => {
      //Prompt user to select Schema file
      let schemaFilePath = "";

      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: "Open",
        filters: {
          "graphqls files": ["graphql", "graphqls", "ts", "js"],
        },
      };


      await vscode.window.showOpenDialog(options).then((fileUri) => {
        console.log("file Uri -> ", fileUri);
        if (fileUri && fileUri[0]) {
          schemaFilePath = fileUri[0].fsPath;
        }
      });

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
          let schemaText = fs.readFileSync(schemaFilePath, "utf8");
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
  );

  context.subscriptions.push(previewSchema);

	
	// Each provider is a set of rules, for what needs to be typed, to create suggestions
	// Providers are similar to event listeners
	const exampleProvider: vscode.Disposable = vscode.languages.registerCompletionItemProvider('javascript', {

		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {

			// a simple completion item which inserts `Hello World!`
			const simpleCompletion = new vscode.CompletionItem('Hello World!');

			// a completion item that inserts its text as snippet,
			// the `insertText`-property is a `SnippetString` which will be
			// honored by the editor.
			const snippetCompletion = new vscode.CompletionItem('Good part of the day');
			snippetCompletion.insertText = new vscode.SnippetString('Good ${1|morning,afternoon,evening|}. It is ${1}, right?');
			const docs : any = new vscode.MarkdownString("Inserts a snippet that lets you select [link](x.ts).");
			snippetCompletion.documentation = docs;
			docs.baseUri = vscode.Uri.parse('http://example.com/a/b/c/');

			// a completion item that can be accepted by a commit character,
			// the `commitCharacters`-property is set which means that the completion will
			// be inserted and then the character will be typed.

			//definitions
			// CompletionItem is text that's suggested by VSCode to the user...
			// - example: if you define completion item as chicken and type "chi" it will show "chicken"

			//We need the completion item to basically be the next item in the query

			const commitCharacterCompletion = new vscode.CompletionItem('chicken');
			commitCharacterCompletion.commitCharacters = ['``'];
			commitCharacterCompletion.documentation = new vscode.MarkdownString('Press `.` to get `console.`');

			// a completion item that retriggers IntelliSense when being accepted,
			// the `command`-property is set which the editor will execute after
			// completion has been inserted. Also, the `insertText` is set so that
			// a space is inserted after `new`
			const commandCompletion = new vscode.CompletionItem('new');
			commandCompletion.kind = vscode.CompletionItemKind.Keyword;
			commandCompletion.insertText = 'new ';
			commandCompletion.command = { command: 'editor.action.triggerSuggest', title: 'Re-trigger completions...' };

			// return all completion items as array
			return [
				simpleCompletion,
				snippetCompletion,
				commitCharacterCompletion,
				commandCompletion
			];
		}
	});

////////////////////////
//Suggestion Provider//
///////////////////////
	const suggestionProvider: vscode.Disposable = vscode.languages.registerCompletionItemProvider(
		'javascript',
		{
			provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
				// Removed to enable multi-line query auto-fill
				// TODO: Break early when it can be determined that the cursor is not within a query string
				// if (!linePrefix.includes("`")) {
				// 	return undefined;
				// }
				const currentSchemaBranch = traverseSchema(schema, history);
				return offerSuggestions(currentSchemaBranch) as vscode.CompletionItem[];
			}
		},
		...triggerCharacters // => ['{', '`']
	);

	context.subscriptions.push(exampleProvider, suggestionProvider);


	vscode.workspace.onDidChangeTextDocument((e) => {
		const lineNumber: number = e.contentChanges[0].range.start.line;
		const characterNumber: number = e.contentChanges[0].range.start.character;
		const line: string = e.document.lineAt(lineNumber).text;
		console.log('row', lineNumber, 'column', characterNumber);

		const messyHistory: string[] = parseQuery(lineNumber, characterNumber, e.document); // Parse the document into an array
		const formattedHistory: string[] = fixBadFormatting(messyHistory); // Stimulate spacing around brackets/parentheses
		const cleanHistory: string[] = ignoreParentheses(formattedHistory); // Ignore the parentheses and their contents
		const cleanerHistory: string[] = filterNestedPaths(cleanHistory); // Ignore nested objects that invalidate the path
		const validHistory: string[] = filterFlatPaths(cleanerHistory); // Ignore properties that aren't part of the history
		history = updateHistory(validHistory);
		
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




/**
 * Given a line from a file, a string is returned representing the indentation
 * in spaces.
 * @param line 
 * @param add Will result in an increase/decrease of returned spacing.
 * @return The amount of spaces representing the indentation
 */
 const lineIndentation = (line: string, add: number = 0): string => {
  // TODO: Update this function to work with tabs as well
  let indentation = 0; // Initialize a counter
  for (const char of line) { // Iterate through each character of the line
    if (char !== ' ') { // If the character is not a space:
      return ' '.repeat(indentation + add); // Return the indentation amount
    } else { // If the character is a space:
      indentation++; // increment the indentation amount
    }
  }
  // In the case where the entire line is filled with spaces:
  return ' '.repeat(indentation + add); // Return the indentation amount
};

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

//Out-of-scope features pre-presentation
// Live-share compatibility (usability)
// ability to detect ONLY graphql query vs parsing the whole document (efficiency)
// splash site 
// vscode publication
// check to see if the cursor is even within a query
// When the suggestion is another nested object show brackets. But when its an endpoint don't show brackets.

