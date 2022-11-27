/* eslint-disable curly */
import { workspace, Uri, WorkspaceConfiguration, window, Disposable } from 'vscode';
import parser from '../parser';
import { arrToObj } from '../extension';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Searches the root directory of the user's workspace for a schema config file.
 * The config file is used to locate the correct schema files to parse.
 */
 export async function configToSchema(): Promise<[any, any, string[], Array<any>] | void> {
	// TODO: Checkout this documentation I found:
	// https://code.visualstudio.com/api/references/vscode-api#WorkspaceConfiguration
	// It looks like there is a cleaner, built-in way to do this.

	// Attempt to find the SurfQL config file within the user's workspace.
	const filepath: string | undefined = await workspace.findFiles('**/surfql.config.json', '**/node_modules/**', 1).then(([ uri ]: Uri[]) => {
		// When no file was found:
		if (!uri) {
			displayConfigPrompt(); // Prompt the user
			return; // Return undefined
		}
		// When a config file was found return the file path.
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
  
	try {
		// Read the schema file and parse it into a usable object.
		const schemaText = fs.readFileSync(schemaPath, "utf8");
		const [objectArr, queryMutation, enumArr, inputArr, scalarArr] = parser(schemaText);
		const queryEntry = arrToObj(queryMutation);
		const schemaObject = arrToObj(objectArr);
		return [queryEntry, schemaObject, [schemaPath], enumArr];
	} catch {
		// Inform the user that the schema path in the config file is invalid.
		displayInvalidConfigPathPrompt();
		// Nothing is returned.
	}
}

function displayConfigPrompt(): void {
	// TODO: Add a "Learn more" button that will send to a link with documentation
	// instructions for creating a surfql config file (with an example).

	// Do nothing when the user specified that they no longer want to see this popup.
	const surfqlConfig: WorkspaceConfiguration = workspace.getConfiguration();
	if (surfqlConfig.get<boolean>('surfql.displayConfigPopup') === false) return;

	// Prompt the user to inform them that they can generate a config file, since
	// no config file was found.
	window.showInformationMessage("No SurfQL config found. Would you like to generate one for this workspace?", 'Generate', 'Okay', 'Don\'t show again')
		.then((userChoice) => {
			// Do nothing when the prompt popup was closed.
			if (userChoice === undefined) return;

			// When the user interacted with the popup: Respond accordingly.
			if (userChoice === 'Generate') {
				generateConfigFile();
			} else if (userChoice === 'Don\'t show again') {
				// The user doesn't want to be notified anymore. Adjust the extension
				// settings to disable this popup.
				// - The 'true' value updates this config setting globally so that the
				//   user won't see this popup in any workspace.
				surfqlConfig.update('surfql.displayConfigPopup', false, true);
			}
		});
}

function displayInvalidConfigPathPrompt(): void {
	// Do nothing when the user specified that they no longer want to see this popup.
	const surfqlConfig: WorkspaceConfiguration = workspace.getConfiguration();
	if (surfqlConfig.get<boolean>('surfql.displayInvalidConfigPathPopup') === false) return;

	// Inform the user that the schema path was invalid.
	window.showInformationMessage('Invalid schema path in the surfql.config.json', 'View file', 'Okay', 'Don\'t show again')
		.then((userChoice) => {
			// Do nothing when the prompt popup was closed.
			if (userChoice === undefined) return;

			// When the user interacted with the popup: Respond accordingly.
			if (userChoice === 'View file') {
				// Open the file so the user can manually update the schema path.
				workspace.openTextDocument(path.join(workspace.workspaceFolders[0].uri.fsPath, 'surfql.config.json'))
					.then((doc) => window.showTextDocument(doc));
			} else if (userChoice === 'Don\'t show again') {
				// The user doesn't want to be notified anymore. Adjust the extension
				// settings to disable this popup.
				// - The 'true' value updates this config setting globally so that the
				//   user won't see this popup in any workspace.
				surfqlConfig.update('surfql.displayInvalidConfigPathPopup', false, true);
			}
		});
}

/**
 * Create a config file for the user automatically in the root directory
 */
export async function generateConfigFile(): Promise<void> {
  // If the config file is already there then just open it instead of overwriting
  // its contents. Otherwise, generate a template config file.
	workspace.findFiles('**/surfql.config.json', '**/node_modules/**', 1).then(([ uri ]: Uri[]) => {
    if (uri) {
      // A SurfQL config file has been found. Let's open it for the user.
      workspace.openTextDocument(uri.fsPath)
        .then((doc) => {
          window.showTextDocument(doc);
          window.showInformationMessage('Opened the previously created SurfQL config. No changes were made.');
        });
    }
		else {
      // Generate a new config file since one hasn't been created in this directory.
      const defaultConfig = { 
        schema: "./path-to-your-schema-file",
        serverLibrary: "Apollo Server" // Currently we only support parsing Apollo Server Libray.
      };
      workspace.fs.writeFile(
        Uri.file(path.join(workspace.workspaceFolders[0].uri.fsPath, 'surfql.config.json')),
        Buffer.from(JSON.stringify(defaultConfig, null, 2))
      ).then(() => {
        // After the file is created, open it so the user can manually update
        // the schema path to an actual schema file.
        workspace.openTextDocument(path.join(workspace.workspaceFolders[0].uri.fsPath, 'surfql.config.json'))
          .then((doc) => {
            window.showTextDocument(doc);
            window.showInformationMessage('The file was created in the root directory. Please update the default schema path within the surfql.config.json file.');
          });
      });
		}
	});
}
