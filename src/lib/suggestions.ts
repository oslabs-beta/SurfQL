import { CompletionItem, CompletionItemKind, SnippetString, TextDocument } from 'vscode';
import { indentation } from '../constants';

/**
 * Navigates current branch and offers suggestions to VSCode Extension
 * @param branch Passes in current branch 
 * @returns VSCode suggestions 
 */
export function offerSuggestions(branch: string[]): CompletionItem[] {
    let suggestions: CompletionItem[] = [];
    branch.forEach((option: string) => {
        let tempCompItem = new CompletionItem(option, CompletionItemKind.Keyword); // What is displayed
        tempCompItem.insertText = new SnippetString('\n' + indentation + option + '${0}\n'); // What is added
        // tempCompItem.command = { command: 'surfql.levelChecker', title: 'Re-trigger completions...', arguments: [e] };
        suggestions.push(tempCompItem);
    }); 
    return suggestions;
}

/**
 * Traverses a schema (recursively) to return the branches at a given level
 * @param schema The parsed schema file.
 * @param history An array representing the traversal path for the obj.
 * @returns The properties/keys at the end of the traversed object.
 */
export function traverseSchema(schema: any, history: string[]): string[] {
    // If our obj isn't an object we have hit the end of our traversal
	if (typeof schema !== 'object') {
        //pokemon - type - electric
        // Check if its incomplete (ex: na... -> name)
		console.log('you\'ve reached the end of the object!');
		return [];
        // if its the last history word
        // if it matches with anything else
        // THEN give back: return Object.keys(schema);
	}
	// If we have hit the end of our history return the nested object keys
    else if (history.length === 0) {
        // history: electr
        // schema: { electric: { move } } 
		return Object.keys(schema);
	}
	// Traverse until and end is reached
  return traverseSchema(schema[history[0]], history.slice(1));
};

//TODO
// [ ] Auto complete anywhere (no trigger characters needed)
// [ ] Config file
// [X] Enable support for 'mutation' or 'query'

/**
 * At any point in the query, this function will suggest/complete what the user typed based on the existing schema.
 * @param schema
 * @param history
 * @return 
 */
export function autoCompleteAnywhere(schema : any, history: string[]) : CompletionItem[] {
    //may require separate trigger character functionality
    const currentSchemaBranch = traverseSchema(schema, history);
	return offerSuggestions(currentSchemaBranch) as CompletionItem[];
}

/**
 * Parses the document returning an array of words/symbols
 * @param lineNumber Lists the VSCode line [index 0] the user is on.
 * @param cursorLocation A number representing the cursor location.
 * @param document The document nested inside a vscode event
 * @return Words/symbols from the start of the query to the cursor
 */
 export function parseQuery(lineNumber: number, cursorLocation:number, document: TextDocument ): string[] {
    let messyHistory: string[] = [];
    let line: string = document.lineAt(lineNumber).text;
    line = line.slice(0, cursorLocation + 1); // Ignore everything after the cursor
    const limit = 1000; // Limits max amount of lines to process

    //Goal: Limit the size of the history array that's storing sections/path of the file
    //Ideation: We define a limit, the while loop will run
    //Issue: there's no way to tell how long the line being pushed is
    
    // Create an array of words (and occasional characters such as: '{')
    // Iterate through the lines of the file (starting from the cursor moving up the file)
    while (lineNumber >= 0 && messyHistory.length <= limit) {
        // When the start of the query was found: This is the last loop
        if (line.includes('`')) {
            lineNumber = -1; // Set line number to -1 to end the loop
            // Slice at the backtick
            const startOfQueryIndex = line.indexOf('`');
            line = line.slice(startOfQueryIndex+1);
        }

        // Detect if the file is compressed into a one-line file.
        // Exit early if the line is 1000+ characters.
        if (line.length > 1000) {
            console.log('Line limit', 1000, 'reached');
            return ['Line limit reached','{'];
            
            // if (...) => display "line limit reached for query parsing"
            //return auto suggest that says "limit reached"
        }
        // ...line.split() ==> array of strings separated by space
        // tempHistory = ...line.split() -> tempHistory.filter()
        // ` pokemon electric attack weight color candy

        messyHistory.push(...line.split(/\s+/g).reverse()); // Split into an array of words (splitting at each white space)
        lineNumber--;
        if (lineNumber >= 0) {
            line = document.lineAt(lineNumber).text;
        }
    }

    // Failed to limit
    console.log('the length of the history array is now', messyHistory.length);
    
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
export function fixBadFormatting(messyHistory: string[]): string[] {
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
export function ignoreParentheses(formattedHistory: string[]): string[] {
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
export function filterNestedPaths(cleanHistory: string[]): string[] {
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
export function filterFlatPaths(cleanerHistory: string[]): string[] {
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
export function updateHistory(validHistory: string[]): string[] {
    let finalHistory: string[] = [];
    console.log('Valid History:', validHistory.join(' -> ') || 'empty...');
    finalHistory = validHistory.map((str) => str.replace('{', '')); // Clean up the opening brackets. Ex: '{name' or '{'
    finalHistory = finalHistory.filter((str) => str); // Filter out the empty strings from the history array
    console.log('History:', finalHistory.join(' -> ') || 'empty...');
    return finalHistory;
}
