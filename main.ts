import { App, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

export default class MoveFilesPlugin extends Plugin {

	async onload() {

		this.addCommand({
            id: 'move-linked-files',
            name: 'Move linked files and update links',
            callback: () => {
                // Obtain the current active file
                const activeFile = this.app.workspace.getActiveFile();
                // Check if there's an active file and it's a markdown file
                if (activeFile && activeFile instanceof TFile && activeFile.extension === 'md') {
                    // Call the export function with the active file
                    this.moveFilesToANewFolder(activeFile);
                } else {
                    new Notice('No active md file.');
                }
            },
        });
	}

	onunload() {

	}

	async moveFilesToANewFolder(file: TFile) {
        const fileContent = await this.app.vault.read(file);
        const imageRegex = /!\[\[(.*?)\]\]|!\[(.*?)\]\((.*?)(?:\|.*?)?\)/g;
        let match;
        const files = [];

        while ((match = imageRegex.exec(fileContent)) !== null) {
            let filePath = match[1] || match[3];
            if (filePath) {
                filePath = decodeURIComponent(filePath.trim());
                if (filePath.includes('|')) {
                    filePath = filePath.split('|')[0];
                }
                files.push(filePath);
            }
        }

        if (files.length === 0) {
            new Notice('No linked files found in the markdown file.');
            return;
        }

        const targetFolderName = `${file.basename} files`;
		const folderExists = this.app.vault.getAbstractFileByPath(targetFolderName);
		if (!folderExists) 
		{
			await this.app.vault.createFolder(targetFolderName).catch(() => {});
		}

        for (const filePath of files) {
            const fileItem = this.app.metadataCache.getFirstLinkpathDest(filePath, file.path);

            if (fileItem instanceof TFile) {
                try {
                    const targetPath = `${targetFolderName}/${fileItem.name}`;
					const targetFile = this.app.vault.getAbstractFileByPath(targetPath);
					
					if(!targetFile)
					{
						await this.app.vault.copy(fileItem,targetPath);
						await this.app.vault.delete(fileItem);

						//update the links in open md file
						const view = this.app.workspace.getActiveViewOfType(MarkdownView);

						// Make sure the user is editing a Markdown file.
						if (view) {
							const line = view.editor.getValue();
							const updatedLine = line.replace(fileItem.name,targetPath);
							view.editor.setValue(updatedLine);
						}
						else {
							new Notice(`Failed to rename ${targetPath}: no active editor`)
							return
						}
						new Notice(`Moved ${fileItem.name} to ${targetPath} and updated the links`);
					}
					else
					{
						new Notice(`Did not Move ${fileItem.name} to ${targetPath} as file already exists`);
					}

                } catch (error) {
                    new Notice(`Failed to move file ${fileItem.name}: ${error}`);
                    console.error(`Failed to move file ${fileItem.name}:`, error);
                }
            } else {
                new Notice(`File not found: ${filePath}`);
                console.error(`File not found: ${filePath}`);
            }
        }
    }
}
