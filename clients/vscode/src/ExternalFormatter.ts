// SPDX-License-Identifier: MIT

import * as child_process from 'child_process'
import * as vscode from 'vscode'
import { getWorkspaceFolder } from './utils'
import { ConfigObject, ExtensionComponent } from './lib/libconfig'

export class DeprecatedExternalFormatter extends ExtensionComponent {
  /// Here temporarily for backward compatibility
  command: ConfigObject<string> = new ConfigObject({
    description:
      'Formatter Command. The file contents will be sent to stdin, and formatted code should be sent back on stdout. E.g. `path/to/verible-format --indentation_spaces=4 -',
    default: '',
    deprecationMessage: 'Use "verilog.formatters" instead.',
    type: 'string',
  })
}

export class ExternalFormatter implements vscode.DocumentFormattingEditProvider {
  private command: string
  provider: vscode.Disposable

  constructor(command: string, formatDirs: string[], languageIds: string[]) {
    this.command = command

    let dirSel = undefined
    if (formatDirs.length > 0) {
      dirSel = formatDirs.length > 1 ? `{${formatDirs.join(',')}}` : formatDirs[0]
    }

    const selectors: vscode.DocumentSelector = languageIds.map((language) => ({
      scheme: 'file',
      language: language,
      pattern: formatDirs.length > 0 ? `${getWorkspaceFolder()}/${dirSel}/**/*` : undefined,
    }))

    this.provider = vscode.languages.registerDocumentFormattingEditProvider(selectors, this)
  }

  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    _options: vscode.FormattingOptions,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.TextEdit[]> {
    if (this.command.length === 0) {
      return
    }
    const split = this.command.split(' ')
    const binPath = split[0]
    const args = split.slice(1)
    if (binPath === undefined) {
      return []
    }

    try {
      const result = child_process.spawnSync(binPath, args, {
        input: document.getText(),
        cwd: getWorkspaceFolder(),
        encoding: 'utf-8',
        timeout: 2000,
      })
      if (result.stdout.length === 0) {
        vscode.window.showErrorMessage('Verilog formatting failed: empty output')
        return []
      }
      if (result.status === null) {
        vscode.window.showErrorMessage('Verilog formatting failed: timed out')
        return []
      }
      return [
        vscode.TextEdit.replace(
          new vscode.Range(
            document.positionAt(0),
            document.lineAt(document.lineCount - 1).range.end
          ),
          result.stdout
        ),
      ]
    } catch (err) {
      vscode.window.showErrorMessage('Formatting failed: ' + (err as Error).toString())
    }

    return []
  }
}
