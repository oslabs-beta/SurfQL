/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { type } from 'os';
import * as vscode from 'vscode';

let queryIntiate = true
let queryLevel : any
interface PokeQuery {
	pokemon: {
		name:string,
		type: string,
		moves: string

	}
}
export function activate(context: vscode.ExtensionContext) {

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

				objArr.forEach(e => {
					suggestions.push(new vscode.CompletionItem(e + ": {", vscode.CompletionItemKind.Method))
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
}
