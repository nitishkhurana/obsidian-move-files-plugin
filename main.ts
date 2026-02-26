import { App, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';

    interface MoveFilesPluginSettings {
            moveMdFile: boolean;
            retainFolderStructure: boolean;
    }

    const DEFAULT_SETTINGS: MoveFilesPluginSettings = {
            moveMdFile: false,
            retainFolderStructure: false,
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

                new Setting(containerEl)
                .setName('Retain folder structure')
                .setDesc('If enabled, the original folder structure of the linked files will be retained in the new folder. If disabled, the new folder will be created in the root directory of the vault.')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.retainFolderStructure)
                    .onChange(async (value) => {
                    this.plugin.settings.retainFolderStructure = value;
                    await this.plugin.saveSettings();
                    }));
            }
            }(this.app, this));
	}

	onunload() {

	}

	async moveFilesToANewFolder(file: TFile) {
        const filesToMove = new Map<string, TFile>();

        const fileCache = this.app.metadataCache.getFileCache(file);
        const embeds = fileCache?.embeds ?? [];
        const links = fileCache?.links ?? [];

        const linkedFiles = [...embeds, ...links]
            .map((linkItem) => this.app.metadataCache.getFirstLinkpathDest(linkItem.link, file.path))
            .filter((linkedFile): linkedFile is TFile => linkedFile instanceof TFile && linkedFile.extension !== 'md');

        for (const linkedFile of linkedFiles) {
            filesToMove.set(linkedFile.path, linkedFile);
        }

        if (this.settings.moveMdFile) {
            filesToMove.set(file.path, file);
        }

        if (filesToMove.size === 0) {
            new Notice('No linked files found in the markdown file.');
            return;
        }
        
        var existingFolderPath = file.parent?.path;
        if(!this.settings.retainFolderStructure)
        {
            existingFolderPath = "";
        }
        const targetFolderName = existingFolderPath ? `${existingFolderPath}/${file.basename} files` : `${file.basename} files`;
		const folderExists = this.app.vault.getAbstractFileByPath(targetFolderName);
		if (!(folderExists instanceof TFolder) )
		{
			await this.app.vault.createFolder(targetFolderName).catch(() => {});
		}

        for (const fileItem of filesToMove.values()) {
            try {
                const sourcePath = fileItem.path;
                const targetPath = `${targetFolderName}/${fileItem.name}`;
                const targetFile = this.app.vault.getAbstractFileByPath(targetPath);

                if (sourcePath === targetPath) {
                    continue;
                }

                if (targetFile instanceof TFile) {
                    new Notice(`Did not move ${fileItem.name} to ${targetPath} as file already exists`);
                    continue;
                }

                await this.app.fileManager.renameFile(fileItem, targetPath);
                new Notice(`Moved ${fileItem.name} to ${targetPath}`);
            } catch (error) {
                new Notice(`Failed to move file ${fileItem.name}: ${error}`);
                console.error(`Failed to move file ${fileItem.name}:`, error);
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
