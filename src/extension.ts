/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { type } from 'os';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let queryIntiate = true
let queryLevel : any
interface PokeQuery {
	pokemon: {
		name:string,
		type: string,
		moves: string

	}
} // /Users/ethanmcrae/test/PathIntellisense/src/test/demo-workspace/project-one/hello/world.txt
export function activate(context: vscode.ExtensionContext) {

	const filePath = path.join(vscode.workspace.rootPath, 'hello/world.txt');
	const fileContents = fs.readFileSync(filePath, 'utf8');
	vscode.window.showInformationMessage(fileContents);
	// const wsedit = new vscode.WorkspaceEdit();
	// const wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath; // gets the path of the first workspace folder
	// const filePath = vscode.Uri.file(wsPath + '/hello/world.txt').toString().slice(7);
	// vscode.window.showInformationMessage(path.resolve('./project-one/hello/world.txt'));
	// vscode.window.showInformationMessage(filePath.toString());
	// const fileContents = fs.readFileSync(filePath);
	// vscode.window.showInformationMessage(JSON.stringify(fileContents));

	//each provider is a set of rules, for what needs to be typed and what will be suggested

	const provider1 = vscode.languages.registerCompletionItemProvider('javascript', {

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
			//example: if you define completion item as chicken and type "chi" it will show "chicken"

			//commitCharacters is the string that triggers the ???
			



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
	const provider2 = vscode.languages.registerCompletionItemProvider(
		'javascript',
		{
			provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {

				const pokeQuery: any = {
					pokemon: {
						name: "Pikachu",
						type: "Electric",
						moves: "Tackle"
					},
					test2: {
						tester: 'test',
					},
					test3: {
						works: true
					}
				}
	

				//Initial activation should be via back tick, but ALL further queries should NOT be using this
				const linePrefix = document.lineAt(position).text.substr(0, position.character);
				if (!linePrefix.includes("`")) {
					return undefined;
				}

				function setLevel(e: any) {
					console.log('the function has been activated and the level is ', e)
				}

				if (queryIntiate == true) {
					let objArr = Object.keys(pokeQuery)
				let suggestions: Array<any> = []

				const indent = lineIndentation(linePrefix, 2);

				objArr.forEach(e => {
					suggestions.push(new vscode.CompletionItem(`\n${indent}` + e + `:{\${1}\n`, vscode.CompletionItemKind.Method))
					console.log(suggestions)
					queryIntiate = false
					queryLevel = e // == "pokemon"	
					
				})
				return suggestions;
				} else {
					let objArr = Object.keys(pokeQuery[queryLevel])

					let suggestions: Array<any> = []

				objArr.forEach(e => {
					suggestions.push(new vscode.CompletionItem(e + ": {", vscode.CompletionItemKind.Method))
					console.log(suggestions)
					queryIntiate = false
					queryLevel = e 

					
					
				})

				return suggestions;
				}

				

				
			}
		},
		'`' // triggered whenever a backtick is being typed
	);

	context.subscriptions.push(provider1, provider2);

	//let's do a poptup for preview Schema
	let previewSchema = vscode.commands.registerCommand('surfql.previewSchema', async () => {
		//Prompt user to select Schema file
		let schemaFilePath = '';

		const options: vscode.OpenDialogOptions = {
			canSelectMany: false,
			openLabel: 'Open',
			filters: {
				'graphqls files': ['graphql', 'graphqls', 'ts', 'js']
			}
		};

		await vscode.window.showOpenDialog(options).then(fileUri => {
			console.log('file Uri -> ', fileUri);
			if (fileUri && fileUri[0]) {
				schemaFilePath = fileUri[0].fsPath;
			}
		});

		//create a newpanel in webView
		const panel = vscode.window.createWebviewPanel(
			"Preview Schema", //viewType, internal use
			"Schema Preview", //Preview title in the tag
			vscode.ViewColumn.Beside, //where the new panel shows
			{
				enableScripts: true
			} //option to add scripts
		);

		
		// Get path to the preview.js script on disk
		const onDiskPath = vscode.Uri.file(
			path.join(context.extensionPath,'scripts', 'preview.js')
		);
		

		console.log('on disk path', onDiskPath);
		//add the previewjs to panel as a accessible Uri
		const scriptSrc = panel.webview.asWebviewUri(onDiskPath);
			
		//Add html content//
		panel.webview.html = getWebViewContent(scriptSrc.toString());

		//add event listener to webview
		panel.webview.onDidReceiveMessage(message => {
			console.log('message1', message);
			if (message.command === 'get schema text') {
				let schemaText = fs.readFileSync(schemaFilePath, 'utf8');
				panel.webview.postMessage({
					command: 'sendText',
					text: schemaText
				});
			};
			return;
		});
	});

}

//Initial preview html content
const getWebViewContent = (scriptSrc: String) => {
	return `<!DOCTYPE html>
				<html lang="en">
					<head>
						<meta charset="UTF-8">
						<meta name="viewport" content="width=device-width, initial-scale=1.0">
						<title>PreviewSchema</title>
						<script type="text/javascript" src="${ scriptSrc }"></script>
					</head>
					<body>
						<h1>Schema Name</h1>
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
 * @return spaces (string)
 */
 const lineIndentation = (line: string, add: number = 0): string => {
  // TODO: Update this function to work with tabs as well
  let indentation = 0; // Initialize a counter
  for (const char of line) { // Iterate through each character of the line
    // console.log(char); // TODO: Remove
    if (char !== ' ') { // If the character is not a space:
      return ' '.repeat(indentation + add); // Return the indentation amount
    } else { // If the character is a space:
      indentation++; // increment the indentation amount
    }
  }
  // In the case where the entire line is filled with spaces:
  return ' '.repeat(indentation + add); // Return the indentation amount
};