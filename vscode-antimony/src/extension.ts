import * as vscode from 'vscode';
import * as utils from './utils/utils';
import * as path from 'path';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import { multiStepInput } from './annotationInput';

let client: LanguageClient | null = null;
let pythonInterpreter: string | null = null;
let lastChangeInterp = 0;

export async function activate(context: vscode.ExtensionContext) {
	// start the language server
	await startLanguageServer(context);
	vscode.workspace.onDidChangeConfiguration(async (e) => {
		// restart the language server using the new Python interpreter, if the related
		// setting was changed
		if (!e.affectsConfiguration('vscode-antimony')) {
			return;
		}
		let curTime = Date.now();
		lastChangeInterp = curTime;
		// delay restarting the client by 3 seconds. i.e. if any other changes were made in 3
		// seconds, then don't do the earlier change
		setTimeout(async () => {
			if (curTime !== lastChangeInterp) {
				return;
			}
			// python interpreter changed. restart language client
			if (client) {
				client.stop();
				client = null;
			}
			await startLanguageServer(context);
		}, 3000);
	})

	// create annotations
	context.subscriptions.push(
		vscode.commands.registerCommand('antimony.createAnnotationDialog',
			(...args: any[]) => createAnnotationDialog(context, args)));

	// convertion
	context.subscriptions.push(
		vscode.commands.registerCommand('antimony.convertAntimonyToSBML',
			(...args: any[]) => convertAntimonyToSBML(context, args)));
	context.subscriptions.push(
		vscode.commands.registerCommand('antimony.convertSBMLToAntimony',
			(...args: any[]) => convertSBMLToAntimony(context, args)));
		

	// language config for CodeLens
	const docSelector = {
		language: 'antimony',
		scheme: 'file',
	}
	let codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
		docSelector,
		new AntCodeLensProvider()
	)
	context.subscriptions.push(codeLensProviderDisposable)
	// TODO: implement color schema
	// vscode.workspace.onDidSaveTextDocument(decorateDocument);
	// vscode.workspace.onDidOpenTextDocument((doc: vscode.TextDocument) => {
	// 	decorateDocument(doc);
	// });
	// vscode.window.onDidChangeActiveTextEditor(async e => {
	// 	decorateDocument(e?.document)
	// });
	// // underline color should change once the color theme changes (dark/light theme)
	// vscode.window.onDidChangeActiveColorTheme(() => decorateDocument(window.activeTextEditor?.document));
}

async function convertAntimonyToSBML(context: vscode.ExtensionContext, args: any[]) {
	if (!client) {
		utils.pythonInterpreterError();
		return;
	}
	await client.onReady();

	await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup")

	const options: vscode.OpenDialogOptions = {
		openLabel: "Select",
		canSelectFolders: true,
		canSelectFiles: false,
		canSelectMany: false,
		filters: {
			'SBML': ['xml']
		},
		title: "Select a location to save your converted model"
    };
   vscode.window.showOpenDialog(options).then(fileUri => {
	   if (fileUri && fileUri[0]) {
	   		vscode.commands.executeCommand('antimony.toSBML', vscode.window.activeTextEditor.document, 
			   	fileUri[0].fsPath).then(async (result) => {
				await checkConversionResult(result, "SBML");
			});
	   }
   });
}

async function convertSBMLToAntimony(context: vscode.ExtensionContext, args: any[]) {
	if (!client) {
		utils.pythonInterpreterError();
		return;
	}
	await client.onReady();

	await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup")

	const options: vscode.OpenDialogOptions = {
			openLabel: "Save",
			canSelectFolders: true,
			canSelectFiles: false,
			canSelectMany: false,
			filters: {
				'Antimony': ['ant']
			},
			title: "Select a location to save your converted model"
	};
	vscode.window.showOpenDialog(options).then(folderUri => {
		if (folderUri && folderUri[0]) {
				vscode.commands.executeCommand('antimony.toAntimony', vscode.window.activeTextEditor.document, 
				folderUri[0].fsPath).then(async (result) => {
					await checkConversionResult(result, "Antimony");
				});
		}
	});
}

async function checkConversionResult(result, type) {
	if (result.error) {
		vscode.window.showErrorMessage(`Could not convert file to ${type}: ${result.error}`)
	} else {
		vscode.window.showInformationMessage(`${result.msg}`)
		const document = await vscode.workspace.openTextDocument(`${result.file}`)
		vscode.window.showTextDocument(document);
	}
}

async function createAnnotationDialog(context: vscode.ExtensionContext, args: any[]) {
	// wait till client is ready, or the Python server might not have started yet.
	// note: this is necessary for any command that might use the Python language server.
	if (!client) {
		utils.pythonInterpreterError();
		return;
	}
	await client.onReady();
	await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup")
	// dialog for annotation
	const selection = vscode.window.activeTextEditor.selection
	// get the selected text
	const selectedText = vscode.window.activeTextEditor.document.getText(selection);
	const initialEntity = selectedText || 'entityName';
	let initialQuery;
	// get current file
	if (args.length == 2) {
		initialQuery = args[1];
	} else {
		initialQuery = selectedText;
	}
	const selectedItem = await multiStepInput(context, initialQuery);
	await insertAnnotation(selectedItem, initialEntity);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	// shut down the language client
	return client.stop();
}

// ****** helper functions ******

// starting language server
async function startLanguageServer(context: vscode.ExtensionContext) {
    pythonInterpreter = getPythonInterpreter();
	// verify the interpreter
	const error = await verifyInterpreter(pythonInterpreter);
	if (error !== 0) {
		let errMessage: string;
		if (error === 1) {
			errMessage = `Failed to launch language server: "${pythonInterpreter}" is not Python 3.7+`;
		} else {
			errMessage = `Failed to launch language server: Unable to run "${pythonInterpreter}"`;
		}
		const choice = await vscode.window.showErrorMessage(errMessage, 'Edit in settings');
		if (choice === 'Edit in settings') {
			await vscode.commands.executeCommand('workbench.action.openSettings', 'vscode-antimony.pythonInterpreter');
		}
		return;
	}
	// create language client and launch server
	const pythonMain = context.asAbsolutePath(
		path.join('src', 'server', 'main.py')
	);
	const args = [pythonMain];
	// Add debug options here if needed
	const serverOptions: ServerOptions = { command: pythonInterpreter, args };
	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{ scheme: "file", language: "antimony" },
		],
	};
	// Create the language client and start the client.
	client = new LanguageClient(
		'AntimonyLanguage',
		'Antimony Language Server',
		serverOptions,
		clientOptions
	);
	// Start the client. This will also launch the server
	const clientDisposable = client.start();
	context.subscriptions.push(clientDisposable);
}

// getting python interpretor
function getPythonInterpreter(): string {
	const config = vscode.workspace.getConfiguration('vscode-antimony');
	return config.get('pythonInterpreter');
}

// verify python interpeter
async function verifyInterpreter(path: string) {
	try {
		const result = await utils.execPromise(`"${path}" -c "import sys; print(sys.version_info >= (3, 7))"`);
		if (result['stdout'].trim() === 'True') {
			return 0;
		}
		return 1;
	} catch (e) {
		return 2;
	}
}

// Provides the CodeLens link to the usage guide if the file is empty.
class AntCodeLensProvider implements vscode.CodeLensProvider {
	async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
		// Only provide CodeLens if file is antimony and is empty
		if (document.languageId === 'antimony' && !document.getText().trim()) {
			const topOfDocument = new vscode.Range(0, 0, 0, 0);
			// TODO: change the link
			let c: vscode.Command = {
				title: 'vscode-antimony Help Page',
				command: 'vscode.open',
				arguments: [vscode.Uri.parse('https://github.com/evilnose/vscode-antimony#usage')],
			}
			let codeLens = new vscode.CodeLens(topOfDocument, c)
			return [codeLens];
		}

		return [];
	}
}

async function insertAnnotation(selectedItem, entityName) {
	const entity = selectedItem.entity;
	const id = entity['id'];
	const prefix = entity['prefix'];
	const snippetText = `\n\n\${1:${entityName}} identity "http://identifiers.org/${prefix}/${id}"`;
	const snippetStr = new vscode.SnippetString(snippetText);
	const doc = vscode.window.activeTextEditor.document;
	const pos = doc.lineAt(doc.lineCount - 1).range.end;
	vscode.window.activeTextEditor.insertSnippet(snippetStr, pos);
}