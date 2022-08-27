// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "surfql" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand("surfql.helloWorld", () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    vscode.window.showInformationMessage("Hello World from SurfQL!");
  });

  //let's do a poptup for preview Schema
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

      //create a newpanel in webView
      const panel = vscode.window.createWebviewPanel(
        "Preview Schema", //viewType, internal use
        "Schema Preview", //Preview title in the tag
        vscode.ViewColumn.Beside, //where the new panel shows
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
          panel.webview.postMessage({
            command: "sendText",
            text: schemaText,
          });
        }
        return;
      });
    }
  );

  context.subscriptions.push(disposable, previewSchema);
}

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
