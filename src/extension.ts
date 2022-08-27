/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { type } from 'os';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let queryIntiate = true;
let queryLevel : any;
interface PokeQuery {
	pokemon: {
		name:string,
		type: string,
		moves: string

	}
}



	//Suggestion: how do we suggest multiple
	const pokeQuery: any = {
		pokemon: {
			name: "Pikachu",
			type: {
				electric: {
					shocking: true,
					treasureChest: {
						treasure: 'yarr'
					}
				},
				water: false
			},
			moves: "Tackle"
		},
		test2: {
			tester: 'test',
		},
		test3: {
			works: true
		}
	}


let history: any[] = [];
let level = 0;


let characters: string[] = ['`','{'];

export function activate(context: vscode.ExtensionContext) {

	//this function accepts the name of the level that's being clicked and suggests the next level
	let levelChecker = vscode.commands.registerCommand('surfql.levelChecker', async (queryText) => {
		console.log(queryText);
		queryLevel = queryText;
	});

	//each provider is a set of rules, for what needs to be typed and what will be suggested

	const provider1: vscode.Disposable = vscode.languages.registerCompletionItemProvider('javascript', {

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
	let provider2: vscode.Disposable = vscode.languages.registerCompletionItemProvider(
		'javascript',
		{
			provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
				
			
				//Initial activation should be via back tick, but ALL further queries should NOT be using this
				const linePrefix = document.lineAt(position).text.substr(0, position.character);
				if (!linePrefix.includes("`")) {
					return undefined;
				}

				function setLevel(e: any) {
					console.log('the function has been activated and the level is ', e)
				}

        const suggestions: Array<any> = [];
				if (queryIntiate === true) {
					let objArr = Object.keys(pokeQuery);

					objArr.forEach(e => {
						let tempCompItem = new vscode.CompletionItem(e + ": ", vscode.CompletionItemKind.Keyword);
						tempCompItem.command = { command: 'surfql.levelChecker', title: 'Re-trigger completions...', arguments: [e] };
						suggestions.push(tempCompItem);
						//console.log(suggestions)
						queryLevel = e; // == "pokemon"	
					});
					level++;
          			queryIntiate = false;
					
			  } 
				else {
					history.push(queryLevel);
						console.log('we are on level', level);
						let objArr = traverseObject(pokeQuery,history);
						
					objArr.forEach(e => {
						let tempCompItem = new vscode.CompletionItem(e + ": ", vscode.CompletionItemKind.Keyword);
						tempCompItem.command = { command: 'surfql.levelChecker', title: 'Re-trigger completions...', arguments: [e] };
						suggestions.push(tempCompItem);
						
						//console.log(suggestions);
						queryIntiate = false;
						queryLevel = e ;
					});
					level++;
				}
				return suggestions;
			}
		},
		...characters // Trigger characters
	);

	context.subscriptions.push(provider1, provider2, levelChecker);

	//step 0: test
// - Do we need provider? And do we need to subscribe the event listener?
// - Can we log the current line on EVERY change?

//step 1: Parse the current query and determine where the user is

//we need to create an event listener of some sort 
//it needs to read the current text 

// "pokemon { type {} }"
// parse the above into our history array: ['pokemon', 'type']
// this needs to be replaced every single iteration of a letter typed/backspaced

// if(pokequery[history[0]]) -> iterate -> pokequery[typ] --> undefined []

//step 2: Develop function that will determine the appropriate query to suggest 
//once the user has backspaced enough
// e.g: Pokemon {type: {ele }} = no suggestion
// e.g: Pokemon {type: { }} = suggest electric

//step 3: Add logic for multi-line queries



vscode.workspace.onDidChangeTextDocument((e) => {
	// console.log(line);
	const lineNumber: number = e.contentChanges[0].range.start.line;
	const characterNumber: number = e.contentChanges[0].range.start.character;
	const line: string = e.document.lineAt(lineNumber).text;
	console.log('the line number is', lineNumber);
	console.log('the character number is', characterNumber);
	//console.log('the position is', new vscode.Position(lineNumber, 20));
	e.document.positionAt;
	
	// figure out way after determing cursor position
	// to navigate left and right until hitting backtick `
	/*

	['pokemon','type','moves'] pokemon.moves
		const query = `
			pokeQuery {
				pokemon {
					type {
						(how to suggest here)
					}
					moves {
						if you see a closing bracket
						ignore the next opening bracket moving bkwrds
					}
					nest3 {

					}
				}
			}
		`
	*/

	currentQuery(lineNumber,characterNumber);

  /**
   * Parses the document returning query information
   * @param lineNumber lists the VSCode line [index 0] the user is on
   * @param cursorLocation a number representing the cursor location
   * @return array of words prior to the users current cursor
   */
	function currentQuery(lineNumber: number, cursorLocation:number): string[] {
		let lineHistory: string[] = [];
		let line: string = e.document.lineAt(lineNumber).text;
    // Cut off everything after the cursor
		line = line.slice(0, cursorLocation + 1);

    // Iterate through the lines of the file (starting from the cursor moving to the start of the file)
		while(lineNumber >= 0) {
			// When the start of the query was found: This is the last loop
			if(line.includes('`')) {
				lineNumber = -1; // Set line number to -1 to end the loop
				// Slice at the backtick
				const startOfQueryIndex = line.indexOf('`');
				line = line.slice(startOfQueryIndex+1);
			}
			
			lineHistory.push(...line.split(/\s+/g).reverse());
			lineNumber--;
			if (lineNumber >= 0) {
				line = e.document.lineAt(lineNumber).text;
			}
		}
    
    // Filter out the empty strings from the array
	//const result = words.filter(word => word.length > 6);
    lineHistory = lineHistory.filter(characters => characters);
		console.log('the previous history is', lineHistory.reverse());
		console.log('the line is', line);
    return lineHistory;
		//console.log(text.split(/\s+/g));

		// decrease line number UNTIL you find `
		// if no backtick return []

		// '       type'.split(' ') => ['', '', '', '', 'type']
		//'pokemon {type { electric {} moves {}}}'.split(/\s+/g); // => ['pokemon', '{}']
		
		//for (let i = 0; i < text.length; i++) {
		//let query = `pokemon {}`
		
			
		//}

		// find ` =  let query = `something`
		// `my name is ${name}`
		//define all strings from ` 

		// Find start ` and end `
		// Do we need to find an end? No 🤔
	}

	function parseQuery(text: string){
		// pokemon type electric
	}

	//parse through text and create array element everytime for every word
	// - Find start/end of query (trim line string)
	// 		- notes: it tracks backticks + curly braces
	// - Parse
});

	
	//
	///////////////////////////////////////
	//////////////////////////////////////
	//let's do a popup for preview Schema
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

// Traverse to the current part of the object based on the history
function traverseObject(obj: any, history: string[]): string[] {
	// If our obj isn't an object we have hit the end of our traversal
	if (typeof obj !== 'object') {
		console.log('youve reached the end of the object!');
		return [];
	}
	// If we have hit the end of our history return the nested object keys
  else if (history.length === 0) {
		return Object.keys(obj);
	}
	// Traverse until and end is reached
  return traverseObject(obj[history[0]], history.slice(1));
};



//Out-of-scope features pre-presentation
// Live-share compatibility (usability)
// ability to detect ONLY graphql query vs parsing the whole document (efficiency)
// splash site 
// vscode publication
// check to see if the cursor is even within a query


//Question for the GQL experts
// - Are dollar signs $ ever used in GQL?