/* eslint-disable curly */
import { CompletionItem, CompletionItemKind, SnippetString, TextDocument, MarkdownString } from 'vscode';
import { indentation } from '../constants';
import { Schema, QueryEntry, SchemaType } from './models';

/**
 * Navigates current branch and offers suggestions to VSCode Extension
 * @param branch Passes in current branch 
 * @returns VSCode suggestions 
 */
export function offerSuggestions(branch: SchemaType): CompletionItem[] {
    let suggestions: CompletionItem[] = [];
    for (const key in branch) {
        let tempCompItem = new CompletionItem(`${key}: Option returned type here`, CompletionItemKind.Keyword); // What is displayed
        if (branch[key].arguments) {
            const insertText = buildArgSnippet(key, branch[key].arguments);
            tempCompItem.insertText = new SnippetString('\n' + indentation + insertText + '${0}\n');
        } else {
            tempCompItem.insertText = new SnippetString('\n' + indentation + key + '${0}\n'); // What is added
        }
        // tempCompItem.command = { command: 'surfql.levelChecker', title: 'Re-trigger completions...', arguments: [e] };
        //TRY to do popup
        tempCompItem.label = `${key}:   ${branch[key].returnType}, args: ${branch[key].arguments ? branch[key].arguments.length : 'None'}`;
        tempCompItem.detail = `return type ${branch[key].returnType}`;
        suggestions.push(tempCompItem);
    }
    // branch.forEach((option: string) => {
    //     let tempCompItem = new CompletionItem(`${option}: Option returned type here`, CompletionItemKind.Keyword); // What is displayed
    //     tempCompItem.insertText = new SnippetString('\n' + indentation + option + '${0}\n'); // What is added
    //     // tempCompItem.command = { command: 'surfql.levelChecker', title: 'Re-trigger completions...', arguments: [e] };
    //     //TRY to do popup
    //     tempCompItem.label = `${option}: type detail here`;
    //     tempCompItem.documentation = new MarkdownString('option type here');
    //     tempCompItem.detail = `return ${option} type detail here`;
    //     suggestions.push(tempCompItem);
    // }); 
    return suggestions;
}

//TODO Iteration, snippet with $1, $2
const buildArgSnippet = (key: string, argArr: Array<any>) => {
    let text = `${key}(`;
    argArr.forEach((e,i) => {
        if (e.defaultValue) {
            text += `${e.argName}: ${e.defaultValue}`;
        } else {
            text += `${e.argName}: ${e.inputType}`;
        }
        if (i < argArr.length -1) {
            text += ', ';
        };
    });
    text += ')';
    return text;
};

// Other Idea:
// -------------
// Instead of having history as an array, why not just build it into an object?
// - Every time a '{' is seen, just nest eveything until the following '}' as a
//   property
// - Include a property 'cursor' with a reference to the current object the
//   cursor is within.
// Example:
/*
    history = {
        cursor: <Object>,
        operator: 'query',
        typedSchema: {
            // This first arguments property is tied to "Banana"/the describor
            arguments: undefined,
            pokemon: {
                arguments: {
                    id: 151
                },
                fields: {
                    id: null,
                    name: null,
                    friends: {
                        arguments: {
                            type: 'WEAK'
                        },
                        fields: {
                            id: null
                            name: null
                        }
                    }
                }
            }

        }
    };
*/

// New plan:
// -----------
// Check for Query or Mutation
// -- If mutation run mutationValidator() before continuing
// -- -- Mutation validator function will validate there is (in order):
// -- -- -- 'mutation'
// -- -- -- descriptive name
// -- -- -- -- with attached paranthesis with a valid input
// -- -- -- '{'
// -- -- -- entry point
// -- -- -- '{'
// -- -- Continue with the return type of the mutation
// -- If not mutation then assume query
// -- -- Remove first 'query' from history (if there is one at position 0)
// -- -- Run queryValidator()
// -- -- -- If there are inner parenthesis then validate them
// -- -- Continue with the return type of the query
// -- -- -- Run a parse entry query function

export function suggestOptions2(schema: Schema, queryEntry: QueryEntry, history: string[]): SchemaType | void { // <- TODO: Remove void
    // New plan:
    // -----------
    // Check for Query or Mutation
    // -- If mutation run mutationValidator() before continuing
    /*
    if (history[0] === 'mutation') {
        try {
            mutationValidator();
        } catch {
            return null;
        }
    } else {
        
    }
    */
    // -- -- Mutation validator function will validate there is (in order):
    // -- -- -- 'mutation'
    // -- -- -- descriptive name
    // -- -- -- -- with attached paranthesis with a valid input
    // -- -- -- '{'
    // -- -- -- entry point
    // -- -- -- '{'
    // -- -- Continue with the return type of the mutation
    // -- If not mutation then assume query
    // -- -- Remove first 'query' from history (if there is one at position 0)
    // -- -- Run queryValidator()
    // -- -- -- If there are inner parenthesis then validate them
    // -- -- Continue with the return type of the query
    // Pass the return type into the traverseSchema function
}

/**
 * Parses through the schema file based on the history to determine possible suggestions.
 * @param schema The global schema variable parsed from the schema file containing all the types.
 * @param queryEntry The global queryEntry variable parsed from the schema file containing all the entry points for each operation (query, mutation, subscribe)
 * @param history An array representing how far into the query the user has traversed so far in the query they're constructing.
 * @returns An array of suggestion strings.
 */
export function suggestOptions(schema: Schema, queryEntry: QueryEntry, history: string[]): SchemaType {
    // TODO:
    // Refactor because there are only 2 operations and 1 other entry type (subscribe).
    
    const firstWord: string = history[0].replace(/(gql)?`/i, ''); // Remove any attached query string initializers
    // Parse the document handling a query initiated with a query operator.
    if (firstWord === 'query') {
        // Find the index to the currently used operation (Query, Mutation, Subscription)
        // and 'query' needs to be type matched to 'Query'.
        const queryOperationIndex: string | void = matchKeyToCorrectCase(queryEntry, firstWord);
        // If the firstWord was found as a valid entry point (Query, Mutation, Subscription):
        if (queryOperationIndex) {
            // Reference the actual entry object (Query, Mutation, Subscription)
            const queryOperation: any = queryEntry[queryOperationIndex]; // TODO: Replace 'any'
            if (history.length > 1) {
                const firstType: string = history[1];
                // Validate that the type is an entry point within the operation (Query, Mutation, Subscription).
                const valid: boolean = Object.keys(queryOperation).some(key => key === firstType);
                if (valid) {
                    // Reference the actual type object (The first type given after the query operator)
                    console.log('Compare', firstType, queryOperation[firstType].returnType);
                    console.log(schema[queryOperation[firstType].returnType]);
                    const type: SchemaType = schema[queryOperation[firstType].returnType];
                    
                    // Pair the schema with the history to traverse the schema to make suggestions
                    //  based off of how nested the user is currently inside the query.
                    return traverseSchema(schema, type, history.slice(2));
                }
                // If the first type is not found within the entry points within the operation
                return null; // Return no suggestions
            }
            else {
                return queryOperation; // Array with the first element as the query name
            }
        }
        // If the first word was not found in the operations then exit
        return null; // Returning no suggestions
    } else if(history[0] === 'mutation') {
        console.log('Mutation isn\'t supported.');
    } else {
        console.log('Query was not used. Need to add support for', history[0]);
    }
}

function matchKeyToCorrectCase(obj: any, key: string): string | void {
    return Object.keys(obj).find(objKey => objKey.toLowerCase() === key.toLowerCase());
}

/**
 * Traverses a schema (recursively) to return the branches at a given level
 * @param schema The parsed schema file.
 * @param history An array representing the traversal path for the obj.
 * @returns The properties/keys at the end of the traversed object.
 */
export function traverseSchema(schema: Schema, type: SchemaType, history: string[]): SchemaType {
    console.log('Type:', type);
    // If our type isn't an object we have hit the end of our traversal
	if (typeof type !== 'object') {
        console.log('You\'ve reached the end of the object!');
		return null;
        // TODO: Check if its incomplete (ex: na... -> name)
        // if its the last history word
        // if it matches with anything else
        // THEN give back: return Object.keys(schema);
	}
	// If we have hit the end of our history return the keys within type.
    else if (history.length === 0) {
        console.log("look at type",type);
        const options: string[] = Object.keys(type);
        console.log('The options are', options.join(', '));
		return type;
	}
	// Traverse until and end is reached
    const nextType: SchemaType = schema[type[history[0]].returnType];
    return traverseSchema(schema, nextType, history.slice(1)) as SchemaType;
};

//TODO
// [ ] Auto complete anywhere (no trigger characters needed)
// [X] Config file
// [X] Enable support for 'mutation' or 'query'

// /**
//  * At any point in the query, this function will suggest/complete what the user typed based on the existing schema.
//  * @param schema
//  * @param history
//  * @return 
//  */
// export function autoCompleteAnywhere(schema : any, history: string[]) : CompletionItem[] {
//     //may require separate trigger character functionality
//     const currentSchemaBranch = traverseSchema(schema, history);
// 	return offerSuggestions(currentSchemaBranch) as CompletionItem[];
// }

/**
 * Parses the document returning an array of words/symbols.
 * However it will exit early if it cannot find the start/end of a query near the cursor.
 * @param cursorY The line number the cursor is currently located.
 * @param cursorX The column number the cursor is currently located.
 * @param document The document nested inside a vscode event.
 * @return Words/symbols from the start of the query to the cursor.
 */
 export function parseQuery(cursorY: number, cursorX: number, document: TextDocument ): string[] {
    // Find the start of the query.
    let messyHistory = findBackTick([], -1, 1000, document, cursorY, cursorX).reverse();
    // Indicate the cursor (mouse) location.
    messyHistory.push('🐭');
    // Find the end of the query.
    messyHistory = findBackTick(messyHistory, 1, 1000, document, cursorY, cursorX);
    // Filter out the empty strings from the query array.
    messyHistory = messyHistory.filter((str) => str); 
    
    console.log('Messy History:', messyHistory.join(' -> ') || 'empty...');
    return messyHistory;
}

/**
 * Appends all characters between the cursor and a backtick.
 * @param history The current history that will be appended to.
 * @param direction 1 or -1 depending on the direction (positive moves down the page).
 * @param limit Limits amount of lines to process / characters on one line to process.
 * @param document The file we will be reading from to find the query.
 * @param cursorY The line number the cursor is currently located.
 * @param cursorX The column number the cursor is currently located.
 * @returns An array of words/characters.
 */
function findBackTick(history: string[], direction: 1 | -1, limit: number, document: TextDocument, lineNumber: number, cursorLocation: number): string[] {
    const newHistory = [];
    let line: string = document.lineAt(lineNumber).text;
    // The slice will depend on the 'direction' parameter.
    // - Ignore everything before/after the cursor
    line = (direction === -1) ? line.slice(0, cursorLocation + 1) : line.slice(cursorLocation + 1);
    
    // Create an array of words (and occasional characters such as: '{')
    // Iterate through the lines of the file (starting from the cursor moving up the file)
    while (lineNumber >= 0 && newHistory.length <= limit) {
        // When the start of the query was found: This is the last loop
        if (line.includes('`')) {
            lineNumber = -2; // Set line number to -2 to end the loop (-1 doesn't work)
            // Slice at the backtick
            const backTickIndex = line.indexOf('`');
            // The slice will depend on the 'direction' parameter.
            // - Ignore everything before/after the back tick
            line = (direction === -1) ? line.slice(backTickIndex + 1) : line.slice(0, backTickIndex);
        }

        // Detect if the file is compressed into a one-line file.
        // Exit early if the line is 1000+ characters (the limit).
        if (line.length > limit) {
            console.log('Line has over', limit, 'characters. Limit reached for parsing.');
            return [];
        }

        // Divide the line (string) into an array of words.
        const arrayOfWords = line.split(/\s+/g);
        // Depending on the direction, reverse the array.
        if (direction === -1) arrayOfWords.reverse();
        // Append the array of words to the new history.
        newHistory.push(...arrayOfWords);
        // Increment in the correct direction
        lineNumber += direction;
        if (lineNumber >= 0) {
            line = document.lineAt(lineNumber).text;
            // If we hit the end of our file exit early
            if (lineNumber === document.lineCount) {
                console.log({lineNumber, total: document.lineCount});
                console.log('Hit EOF without finding the backtick. Direction:', direction);
                return [];
            }
        }
    }

    // The appending location will depend on the 'direction' parameter.
    return (direction === -1) ? [...newHistory, ...history] : [...history, ...newHistory];
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
    console.log('=========================================');
    console.log('Formatted History:', formattedHistory.join(' -> ') || 'empty...');
    console.log('=========================================');
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
        // Leaving the first word as it will be the query type (ex: query, mutation, etc...)
        if (cleanerHistory[i + 1] === '{' || i === 0) {
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
