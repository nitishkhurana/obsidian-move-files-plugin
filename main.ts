import { App, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';

    interface MoveFilesPluginSettings {
            moveMdFile: boolean;
    }

    const DEFAULT_SETTINGS: MoveFilesPluginSettings = {
            moveMdFile: false,
    };

    

export default class MoveFilesPlugin extends Plugin {
        settings: MoveFilesPluginSettings = DEFAULT_SETTINGS;

	async onload() {

        await this.loadSettings();

		this.addCommand({
            id: 'move-linked-files',
            name: 'Move linked files and update links',
            checkCallback: (checking: boolean) => {
                // Obtain the current active file
                const activeFile = this.app.workspace.getActiveFile();
                // Check if there's an active file and it's a markdown file
                if (activeFile && activeFile instanceof TFile && activeFile.extension === 'md') {
                    //If the check is true then the command will be shown to the user else the command is not visible
                    //If it is true then the callback is called with checking as false, so execute the command
                    if(!checking)
                    {
                        // Call the export function with the active file
                        this.moveFilesToANewFolder(activeFile);
                    }
                    return true;
                }
                    return false;
            },
        });

        this.addSettingTab(new class extends PluginSettingTab {
            plugin: MoveFilesPlugin;
            constructor(app: App, plugin: MoveFilesPlugin) {
                super(app, plugin);
                this.plugin = plugin;
            }

            display(): void {
                const { containerEl } = this;
                containerEl.empty();
                containerEl.createEl('h2', { text: 'Move Files Plugin Settings' });

                new Setting(containerEl)
                .setName('Move the current open markdown file itself')
                .setDesc('If enabled, the markdown file will also be moved to the new folder.')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.moveMdFile)
                    .onChange(async (value) => {
                    this.plugin.settings.moveMdFile = value;
                    await this.plugin.saveSettings();
                    }));
            }
            }(this.app, this));
	}

	onunload() {

	}

	async moveFilesToANewFolder(file: TFile) {
        const files = [];

        const embeds = this.app.metadataCache.getFileCache(file)?.embeds ?? [];
        const fileLinks = embeds.map(embed => this.app.metadataCache.getFirstLinkpathDest(embed.link, file.path)).filter(file => file?.extension !== 'md');

        for (const file of fileLinks) {
            if (file instanceof TFile) {
                files.push(file.path);
            }
        }

        if (this.settings.moveMdFile) {
            // If the setting is enabled, include the markdown file itself
            files.push(file.path);
        }

        if (files.length === 0) {
            new Notice('No linked files found in the markdown file.');
            return;
        }

        const targetFolderName = `${file.basename} files`;
		const folderExists = this.app.vault.getAbstractFileByPath(targetFolderName);
		if (!(folderExists instanceof TFolder) )
		{
			await this.app.vault.createFolder(targetFolderName).catch(() => {});
		}

        for (const filePath of files) {
            const fileItem = this.app.metadataCache.getFirstLinkpathDest(filePath, file.path);

            if (fileItem instanceof TFile) {
                try {
                    const targetPath = `${targetFolderName}/${fileItem.name}`;
					const targetFile = this.app.vault.getAbstractFileByPath(targetPath);
					
					if(!(targetFile instanceof TFile))
					{
						await this.app.fileManager.renameFile(fileItem,targetPath);

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
						new Notice(`Did not move ${fileItem.name} to ${targetPath} as file already exists`);
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

    async loadSettings() {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
            await this.saveData(this.settings);
    }
}
