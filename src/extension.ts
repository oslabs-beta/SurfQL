/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { type } from 'os';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import parser from "./parser";

// let schema: any = {
// 	pokemon: {
// 		name: "Pikachu",
// 		type: {
// 			electric: {
// 				shocking: true,
// 				treasureChest: {
// 					treasure: 'yarr'
// 				}
// 			},
// 			water: false
// 		},
// 		moves: {
// 			fighting: {
// 				id: 42
// 			}
// 		}
// 	},
// 	test2: {
// 		tester: 'test',
// 	},
// 	test3: {
// 		works: true
// 	}
// };

let schema: any = {
	'Import a schema file...': 0
}

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
          const [schemaArr, queryMutation, enumArr, returnObj] = parser(schemaText);
          console.log(returnObj);
		  schema = createNestedObj(returnObj);
          panel.webview.postMessage({
            command: "sendSchemaInfo",
            text: JSON.stringify([schemaArr,queryMutation, enumArr]),
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

	const suggestionProvider: vscode.Disposable = vscode.languages.registerCompletionItemProvider(
		'javascript',
		{
			provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
				const linePrefix = document.lineAt(position).text.substr(0, position.character);
				const triggerCharacter = linePrefix.at(-1);
				console.log('Trigger Character:', triggerCharacter);

				// Removed to enable multi-line query auto-fill
				// TODO: Break early when it can be determined that the cursor is not within a query string
				// if (!linePrefix.includes("`")) {
				// 	return undefined;
				// }
				
				//Step 1: analyze what has been typed by the user, between the backticks
				// ex: Pokequery -> if what the user has typed == obj.keys
				//  - Register pokequery as our main object
				//  - Or... schemaFile: { Dishes:{} Order:{} ...{} }
				//    - For example: Pokequery is now comparable to schemaFile.
				//    - We will always use our schemaFile as our root (thats what we initialize with all the sub schemas)
				
				const suggestions: Array<any> = [];
				const objArr = traverseObject(schema, history);

				objArr.forEach(e => {
					let tempCompItem = new vscode.CompletionItem(e, vscode.CompletionItemKind.Keyword); // What is displayed
					tempCompItem.insertText = new vscode.SnippetString('\n' + indentation + e + '${0}\n'); // What is added
					// tempCompItem.command = { command: 'surfql.levelChecker', title: 'Re-trigger completions...', arguments: [e] };
					suggestions.push(tempCompItem);
				});
				
				return suggestions;
			}
		},
		...triggerCharacters // => ['{', '`']
	);

	context.subscriptions.push(exampleProvider, suggestionProvider);

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
		const lineNumber: number = e.contentChanges[0].range.start.line;
		const characterNumber: number = e.contentChanges[0].range.start.character;
		const line: string = e.document.lineAt(lineNumber).text;
		console.log('row', lineNumber, 'column', characterNumber);
		e.document.positionAt;

		const messyHistory: string[] = parseQuery(lineNumber, characterNumber); // Parse the document into an array
		const formattedHistory: string[] = fixBadFormatting(messyHistory); // Stimulate spacing around brackets/parentheses
		const cleanHistory: string[] = ignoreParentheses(formattedHistory); // Ignore the parentheses and their contents
		const cleanerHistory: string[] = filterNestedPaths(cleanHistory); // Ignore nested objects that invalidate the path
		const validHistory: string[] = filterFlatPaths(cleanerHistory); // Ignore properties that aren't part of the history
		updateHistory(validHistory);
		
		// How to ignore other paths when creating a history to the cursor?
		/*
			const query = `
				pokeQuery {
					pokemon {
						type(first: 10) {
							how to suggest here when the trigger character wasn't typed?
							- When an auto-suggestion was made but not chosen...
							- ...but it was manually started to get typed out
							- Example: f -> fire | flying | fighting (all start with 'f')
						}
						moves {
							if you see a closing bracket
							ignore the next opening bracket moving bkwrds
						}
						id
						nest3 {
							if you see a flat property
							ignore it
						}
					}
				}
			`
		*/
		// For a nested object:
		// - This is determined by finding a closing bracket
		// - Ignore everything from the closing bracket to the next opening bracket + the preceeding word
		// For a flat property:
		// - Ignore it if there is no opening bracket between you and it
		// - This may include it being standalone: '{' or attached to a word: 'pokemon{'
		// Approach:
		// - After line history has been created
		// - Filter out all empty strings
		// - Going backwards, determine the validity considering either scenario mentioned above

		/**
		 * Parses the document returning an array of words/symbols
		 * @param lineNumber Lists the VSCode line [index 0] the user is on.
		 * @param cursorLocation A number representing the cursor location.
		 * @return Words/symbols from the start of the query to the cursor
		 */
		function parseQuery(lineNumber: number, cursorLocation:number): string[] {
			let messyHistory: string[] = [];
			let line: string = e.document.lineAt(lineNumber).text;
			line = line.slice(0, cursorLocation + 1); // Ignore everything after the cursor

			// Create an array of words (and occasional characters such as: '{')
			// Iterate through the lines of the file (starting from the cursor moving up the file)
			while (lineNumber >= 0) {
				// When the start of the query was found: This is the last loop
				if (line.includes('`')) {
					lineNumber = -1; // Set line number to -1 to end the loop
					// Slice at the backtick
					const startOfQueryIndex = line.indexOf('`');
					line = line.slice(startOfQueryIndex+1);
				}
				
				messyHistory.push(...line.split(/\s+/g).reverse());
				lineNumber--;
				if (lineNumber >= 0) {
					line = e.document.lineAt(lineNumber).text;
				}
			}
			
			// Clean up the parsed query array into a useable history array
			messyHistory = messyHistory.filter((str) => str); // Filter out the empty strings from the query array
			messyHistory.reverse(); // The nested order is opposite from how it is typed
			
			console.log('Messy History:', messyHistory.join(' -> ') || 'empty...');
			return messyHistory;
		}

		/**
		 * Fixes cases where the words within the array are attached to the brackets/parentheses.
		 * @param messyHistory 
		 * @return An array of words with the brackets and parentheses detached.
		 */
		function fixBadFormatting(messyHistory: string[]): string[] {
			return messyHistory.reduce((relevant: string[], word: string) => {
				let reformedWord = ''; // Will hold the words as they are re-formed
				for (const char of word) {
					if (/{|}|\(|\)/.test(char)) { // Test if char is '{', '}', '(', or ')'
						if (reformedWord) {
							relevant.push(reformedWord); // If a word is already formed then push that as its own word
							reformedWord = ''; // Reset the word
						}
						relevant.push(char); // Add the '{', '}', '(', or ')'
					} else {
						reformedWord += char; // Keep building upon the current word
					}
				}
				if (reformedWord) {
					relevant.push(reformedWord); // Before moving on, check to see if there is a word that needs to get added
				}
				return relevant; // Return the total words so far
			}, [] as string[]);
		}

		/**
		 * Parenthesis don't affect the history. Remove them from the array so they don't interfere with the path.
		 * @param formattedHistory An unfiltered array that potentially contains parentheses.
		 * @return An array without parentheses and inner contents of parentheses.
		 */
		function ignoreParentheses(formattedHistory: string[]): string[] {
			console.log('Formatted History:', formattedHistory.join(' -> ') || 'empty...');
			const cleanHistory: string[] = []; // The return result of only relevant strings
			let ignoring: boolean = false; // The status of the filter/loop process
			for (const word of formattedHistory) {
				if (ignoring) {
					// Ignore from an opening '(' to a closing ')'
					if (word === ')') {
						ignoring = false;
					}
				} else {
					if (word === '(') {
						// Check for an opening '('
						ignoring = true;
					} else {
						// Preserve the word
						cleanHistory.push(word);
					}
				}
			}
			return cleanHistory;
		}

		/**
		 * Filter out nested side paths from the history array.
		 * @param cleanHistory An array with a valid history path that needs to be isolated.
		 * @return An array without nested side paths.
		 */
		function filterNestedPaths(cleanHistory: string[]): string[] {
			console.log('Clean History:', cleanHistory.join(' -> ') || 'empty...');

			const newHistory: string[] = [];
			
			let ignore: number = 0; // The amount of nested side paths we are within at a given point
			// Loop through the array backwards
			for (let i = cleanHistory.length - 1; i >= 0; i--) {
				const word = cleanHistory[i]; // The current array element
				if (word === '}') {
					ignore++; // When we find a closing bracket ignore everything up to the opening bracket
				} else if (ignore) {
					if (word === '{') {
						i--; // When we find the opening bracket ignore the following word
						ignore--; // Indicate we have escaped a nested side path
					}
				} else {
					newHistory.unshift(word); // The current word is valid for this process
				}
			}

			return newHistory;
		}

		/**
		 * Filter out properties that don't connect the cursor to the start of the query.
		 * @param cleanerHistory An array with a valid history path that needs to be isolated.
		 * @return An array without side properties.
		 */
		function filterFlatPaths(cleanerHistory: string[]): string[] {
			console.log('Cleaner History:', cleanerHistory.join(' -> ') || 'empty...');
			const validHistory: string[] = [];
			cleanerHistory.forEach((word: string, i: number) => {
				// Make sure the current word isn't a property.
				if (cleanerHistory[i + 1] === '{') {
					validHistory.push(word); // Add as a valid word
				}
			});
			return validHistory;
		}

		/**
		 * Cleans up an array to be used as the new history.
		 * @param validHistory An array representing the words within a query that connect the start of a query to the cursor.
		 * @return Nothing... but history is re-declared.
		 */
		function updateHistory(validHistory: string[]): void {
			console.log('Valid History:', validHistory.join(' -> ') || 'empty...');
			history = validHistory.map((str) => str.replace('{', '')); // Clean up the opening brackets. Ex: '{name' or '{'
			history = history.filter((str) => str); // Filter out the empty strings from the history array
			console.log('History:', history.join(' -> ') || 'empty...');
		}
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

/**
 * Traverses an object to return the properties/keys at a given level
 * @param obj Traditionally: the parsed query file.
 * @param history An array representing the traversal path for the obj.
 * @returns The properties/keys at the end of the traversed object.
 */
function traverseObject(obj: any, history: string[]): string[] {
	// If our obj isn't an object we have hit the end of our traversal
	if (typeof obj !== 'object') {
		console.log('you\'ve reached the end of the object!');
		return [];
	}
	// If we have hit the end of our history return the nested object keys
  else if (history.length === 0) {
		return Object.keys(obj);
	}
	// Traverse until and end is reached
  return traverseObject(obj[history[0]], history.slice(1));
};

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

//Question for the GQL experts
// Are dollar signs $ ever used in GQL?
