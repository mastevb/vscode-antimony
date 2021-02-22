import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';
import { privateEncrypt } from 'crypto';

suite('Should do completion', () => {
	const docUri = getDocUri('completion.txt');

	test('Completes Antimony in txt file', async () => {
		await testCompletion(docUri, new vscode.Position(0, 0), {
			items: [
				{ label: 'JavaScript', kind: vscode.CompletionItemKind.Text },
				{ label: 'TypeScript', kind: vscode.CompletionItemKind.Text }
			]
		});
	});
});

async function testCompletion(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedCompletionList: vscode.CompletionList
) {
	await activate(docUri);

	// Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
	const actualCompletionList = (await vscode.commands.executeCommand(
		'vscode.executeCompletionItemProvider',
		docUri,
		position
	)) as vscode.CompletionList;

	assert.ok(actualCompletionList.items.length == 5);
	// expectedCompletionList.items.forEach((expectedItem, i) => {
	// 	const actualItem = actualCompletionList.items[i];
	// 	assert.strictEqual(actualItem.label, expectedItem.label);
	// 	assert.strictEqual(actualItem.kind, expectedItem.kind);
	// });
}
