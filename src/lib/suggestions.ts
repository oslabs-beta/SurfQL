/* eslint-disable curly */
import { CompletionItem, CompletionItemKind, SnippetString, TextDocument, MarkdownString } from 'vscode';
import { indentation } from '../constants';
import { Schema, QueryEntry, SchemaType } from './models';

/**
 * Navigates current branch and offers suggestions to VSCode Extension
 * @param branch Passes in current branch 
 * @returns VSCode suggestions 
 */
export function offerSuggestions(branch: SchemaType, currentLine: string): CompletionItem[] {
    
    let suggestions: CompletionItem[] = [];
    for (const key in branch) {
        let tempCompItem = new CompletionItem(`${key}: Option returned type here`, CompletionItemKind.Keyword); // What is displayed
        if (branch[key].arguments) {
            const insertText = buildArgSnippet(key, branch[key].arguments);
            tempCompItem.insertText = completionText(currentLine, insertText);
        } else {
            tempCompItem.insertText = completionText(currentLine, key); // What is added
        }
        // tempCompItem.command = { command: 'surfql.levelChecker', title: 'Re-trigger completions...', arguments: [e] };
        //TRY to do popup
        tempCompItem.label = `${key}:   ${branch[key].returnType}, args: ${branch[key].arguments ? branch[key].arguments.length : 'None'}`;
        tempCompItem.detail = `return type ${branch[key].returnType}`;
        suggestions.push(tempCompItem);
    }
    return suggestions;
}

const completionText = (currentLine: string, text: string): SnippetString => {
  const openBraceIndex = currentLine.lastIndexOf('{');
  const closeBraceIndex = currentLine.lastIndexOf('}');
  const newIndent = openBraceIndex !== -1
    && (openBraceIndex < closeBraceIndex);
  
  return (newIndent)
    ? new SnippetString('\n' + indentation + text + '${0}' + '\n')
    : new SnippetString(text + '${0}');
};

const buildArgSnippet = (key: string, argArr: Array<any>) => {
    let text = `${key}(`;
    let selectionIndex = 1; // The index used to tab between autofilled sections to manually change
    argArr.forEach((e,i) => {
        if (e.defaultValue) {
            text += `${e.argName}: \${${selectionIndex++}:${e.defaultValue}}`;
        } else {
            text += `${e.argName}: \${${selectionIndex++}:${e.inputType}}`;
        }
        if (i < argArr.length -1) {
            text += ', ';
        };
    });
    text += ')';
    return text;
};

/**
 * Converts a history array to a history object.
 * @param historyArray Any array of strings representing a valid query
 * @returns A nested object that resembles the document's query
 */
export function historyToObject(historyArray: string[]) {
    const historyObj: any = { typedSchema: {} };
    let newHistory = [...historyArray];
    
    // Determine the operator.
    if (newHistory[0].toLowerCase() === 'query' || newHistory[0] === '{') {
        historyObj.operator = 'query';
    } else if (newHistory[0].toLowerCase() === 'mutation') {
        historyObj.operator = 'mutation';
    } else {
        console.log('Throwing error: Invalid query format');
        throw new Error('Invalid query format');
    }

    // Determine if there are outter arguments (always the case for valid mutations).
    if ((historyObj.operator === 'mutation') || (newHistory[0].toLowerCase() === 'query' && newHistory[2] === '(')) {
        const {inners, outters} = collapse(newHistory, '(', ')');
        newHistory = outters;
        historyObj.typedSchema._args = parseArgs(inners);
    }

    // Recursively nest into the typed schema to build out the historyObj.
    traverseHistory(collapse(newHistory, '{', '}').inners, historyObj.typedSchema, historyObj);

    // Return the history object that was constructed from the history array.
    return historyObj;
}

/**
 * Takes in an array, removing everything between the first set of opening
 * and closing characters. The enclosed area (inners) and surrounding area
 * (outters) are returned as well as the modification count (skipped).
 * @param arr Any array of strings (history array)
 * @param openingChar Any character: '{', '(', etc...
 * @param closingChar Any character: '}', ')', etc...
 * @returns {inners, outters, skipped}
 */
function collapse(arr: string[], openingChar: string, closingChar: string) {
    const outters: string[] = []; // The contents outside the opening/closing chars
    const inners: string[] = []; // The contents within the opening/closing chars
    let state: number = 0; // 0 when outside (outters); >= 1 when inside (inners)
    let skipped: number = 0; // Tracks how many words were added to inners
    let initialized: boolean = false; // Helps determine when the encapsulation is finished
    let finished: boolean = false; // When finished the rest of the words are added to outters
    for (const word of arr) {
        if (finished) {
            // Checking to see if the encapsulation (collapse) has finished.
            outters.push(word); // When collapse is finished add the rest to outters
        } else if (word === openingChar) {
            // Checking to see if the current word matches the opening char.
            initialized = true; // Initialize search (may repeat which is okay)
            if (state) inners.push(word); // If this is nested within the encapsulation then include it in the inners
            state++; // Increment the state: We are nested 1 level deeper now
            skipped++; // Increment the skipped count
        } else if (word === closingChar) {
            // Checking to see if the current word matches the closing char.
            state--; // Decrement the state: We are 1 level less nested now
            if (state) inners.push(word); // If this is nested within the encapsulation then include it in the inners
            skipped++; // Increment the skipped count
            if (initialized && state <= 0) finished = true; // Check for completion
        } else {
            // Otherwise add the current word to its respective array.
            if (state) {
                inners.push(word);
                skipped++;
            } else {
                outters.push(word);
            }
        }
    }
    return { outters, inners, skipped };
}

/**
 * Parses an array of strings into an object with argument data.
 * @param inners Inners captured from the collapse() method integrate well
 * @returns An object resembling key/value pairs of Apollo GraphQL arguments
 */
function parseArgs(inners: string[]) {
    // TODO: Convert any type from a string to its intended type for type testing
    // - Example: "3" -> 3 (number)
    // - Example: "[1," "2," "3]" -> [1, 2, 3] (array/nested)
    // - Example: "{" "int:" "3" "}" -> {int: 3} (object/nested)
    // - etc...
    const args: any = {};
    // Iterate through the argument inners.
    for (let i = 0; i < inners.length; i++) {
        // Declare the current and next values for convenience.
        const current: string = inners[i];
        const next: string = inners[i + 1];
        // The current key/value involves an object.
        if (next === '{') {
            // Leverage 'skipped' from collapse() to ignore the object details.
            const { skipped } = collapse(inners.slice(i), '{', '}');
            i += skipped;
            args[current.slice(0, -1)] = {}; // Assign an empty object as a indicator
        }
        // The current key/value does not involve an object.
        else {
            // Slice off the ':' and add the key/value pair to obj
            args[current.slice(0, -1)] = next.replace(/,$/, ''); // Also ignore trailing commas
            i++; // Increment i an extra time here to move to the next 2 key/values.
        }
    }
    return args;
}

/**
 * Traverses a history array to recursively build out the object array.
 * @param historyRef The current section of history that needs to be parsed
 * @param obj The portion of the history object that is being built
 * @param entireHistoryObj The entire history object used to reference root-level properties
 */
function traverseHistory(historyRef: string[], obj: any, entireHistoryObj: any): void {		
    // Do not mutate the original history to keep this function pure.
    let history: string[] = [...historyRef];

    // Check to see what follows the field to see what type it is (nested?)
    for (let i = 0; i < history.length; i++) {
        let current = history[i];
        let next = history[i + 1];
        let newObj: string | any = {};

        // The cursor is at this level.
        if (current === '🐭') {
            // TODO: Invoke a helper function here that looks to the left and right to see if the cursor 🐭 is within parens (params). I think we would need to also keep track of the word before the opening paren as well as the rest of the contents (besides the 🐭). What to do with this data? I'm not sure yet. I guess just set `obj._paramSuggestion = true` and then when the schema is aligned with the history object later it can work that out to generate accurate param suggestions from the schema?
            entireHistoryObj.cursor = obj; // TODO: Remove this? Quick access to the cursor object has never been leveraged.
            obj._cursor = true; // ⭐️ Signify that the cursor was found at this level
            continue; // Increment i and iterate the loop
        }

        obj[current] = newObj;  // Default to expect a nested field

        // Check for arguments:
        if (next === '(') {
            const { inners, skipped } = collapse(history.slice(i), '(', ')');
            const args = parseArgs(inners); // Parse the arguments
            newObj._args = args; // Assign the arguments to the new object
            i += skipped; // Skip the rest of the argument inners
            current = history[i]; // Reassign 'current' for the following if block
            next = history[i + 1]; // Reassign 'next' for the following if block
        }
        // Check for a bracket signifying a nested field:
        if (next === '{') {
            const { inners, skipped } = collapse(history.slice(i), '{', '}');
            // Skip what was found within the nested field and continue to process
            // other fields at this level.
            i += skipped;
            // Recurse to process the nested field that was skipped.
            traverseHistory(inners, newObj, entireHistoryObj);
        }
        // If the field was not nested: Add the scalar's property.
        else {
            obj[current] = 'Scalar';
        }
    }
}

/**
 * Removed all fields that do not lead up to / surround the cursor.
 * @param history The history object
 * @returns A smaller history object
 */
export function isolateCursor(history) {
    // Break case: the cursor is found
    if (history._cursor) {
        // Flattens other side paths
        return Object.entries(history).reduce((obj, [key, value]) => {
            if (key === '_args') obj[key] = value;
            else if (typeof value === 'object') obj[key] = 'Field';
            else if (key === '_cursor') obj[key] = true;
            else obj[key] = 'Scalar';
            return obj;
        }, {});
    }

    // Recurse case: Nest until the cursor is found
    for (const field in history) {
        if (typeof history[field] === 'object') {
            const traverse = isolateCursor(history[field]);
            if (traverse) return { [field]: traverse };
        }
    }
}

/**
 * Compares the history with the schema to make field suggestions.
 * @param history The history object
 * @param schema The schema object
 * @param queryEntry The query entry object
 * @returns An object containing suggestion data
 */
export function getSuggestions(history: any, schema: any, queryEntry: any) {
    // Get the right casing for the operator
    for (const entry in queryEntry) {
        if (entry.toLowerCase() === history.operator) {
            history.operator = entry; // Reassign the operator with the correct case
            break; // Exit: The correct operator was found and updated
        }
    }

    // Exit early when there is no entry point (operator)
    const entryPoint = queryEntry[history.operator];
    if (!entryPoint) {
        console.log('Invalid query entry. Check the schema for entry points.');
        return {};
    }

    // If the cursor is at the outter-most level then return those outter-most
    // fields as suggestions.
    const typedHistory = history.typedSchema;
    if (typedHistory._cursor) {
        return filterOutUsedFields(typedHistory, entryPoint); // suggestions
    }

    // Exit early when there is no more history.
    const nestedHistory = Object.keys(typedHistory)[0];
    if (!nestedHistory) return {};

    // Traverse the rest of the way.
    const returnType = entryPoint[nestedHistory].returnType;
    return traverseSchema(typedHistory[nestedHistory], schema, returnType);
}

/**
 * Traverses through the history and schema to find the fields surrounding
 * the cursor. Suggestions will be created based off of the remaining unused
 * fields.
 * @param history The history object
 * @param schema The schema object
 * @param returnType The current field within the schema
 * @returns 
 */
function traverseSchema(history: any, schema: any, returnType: string) {
    // Exit early: End of history/schema.
    if (!history || !returnType) return {};

    // If the cursor depth was found:
    if (history._cursor) {
        // Convert the unused fields to suggestion objects.
        return filterOutUsedFields(history, schema[returnType]);
    }

    // Break early when there is no more history to traverse through.
    const nestedHistory: string = Object.keys(history)[0];
    if (!nestedHistory) return {};

    // Otherwise traverse to find the fields at a deeper level.
    const nestedReturnType: string = schema[returnType][nestedHistory].returnType;
    return traverseSchema(history[nestedHistory], schema, nestedReturnType);
}

/**
 * Compares the history with the schema to only return unused fields for
 * suggestions.
 * @param history The history object 
 * @param schema The schema object
 * @returns Suggestion objects
 */
function filterOutUsedFields(history: any, schema: any) {
    const suggestion: any = {};
    const historyFields: string[] = Object.keys(history);
    // Look through all the possible fields at this level.
    for (const [key, value] of Object.entries(schema)) {
        const valueWithType: any = value; // A typescript lint fix
        // If the schema field hasn't been typed yet:
        if (!historyFields.includes(key)) {
            // Add it as a suggestion.
            suggestion[key] = {
                arguments: valueWithType.arguments,
                returnType: valueWithType.returnType
            };
        }
    }
    return suggestion; // Return all the suggestion objects
}

/**
 * Parses the document returning an array of words/symbols.
 * However it will exit early if it cannot find the start/end of a query near the cursor.
 * @param cursorY The line number the cursor is currently located.
 * @param cursorX The column number the cursor is currently located.
 * @param document The document nested inside a vscode event.
 * @return Words/symbols from the start of the query to the cursor.
 */
 export function parseDocumentQuery(cursorY: number, cursorX: number, document: TextDocument): string[] {
    // Find the start of the query.
    let messyHistory: string[] = findBackTick([], -1, 1000, document, cursorY, cursorX).reverse();
    // Indicate the cursor (mouse) location.
    messyHistory.push('🐭');
    // Find the end of the query.
    messyHistory = findBackTick(messyHistory, 1, 1000, document, cursorY, cursorX);
    // Filter out the empty strings from the query array.
    messyHistory = messyHistory.filter((str) => str); 
    // Return
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
export function fixBadHistoryFormatting(messyHistory: string[]): string[] {
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
