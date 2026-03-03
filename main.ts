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

    private normalizePath(inputPath: string): string {
        return inputPath.replace(/\\/g, '/');
    }

    private extractLinkpath(rawLink: string): string {
        const aliasIndex = rawLink.indexOf('|');
        const subpathIndex = rawLink.indexOf('#');

        let endIndex = rawLink.length;
        if (aliasIndex >= 0) {
            endIndex = Math.min(endIndex, aliasIndex);
        }
        if (subpathIndex >= 0) {
            endIndex = Math.min(endIndex, subpathIndex);
        }

        return rawLink.slice(0, endIndex).trim();
    }

    private replaceLinkpathPreservingContext(rawLink: string, newLinkpath: string): string {
        const aliasIndex = rawLink.indexOf('|');
        const subpathIndex = rawLink.indexOf('#');

        let endIndex = rawLink.length;
        if (aliasIndex >= 0) {
            endIndex = Math.min(endIndex, aliasIndex);
        }
        if (subpathIndex >= 0) {
            endIndex = Math.min(endIndex, subpathIndex);
        }

        return `${newLinkpath}${rawLink.slice(endIndex)}`;
    }

    private escapeRegex(input: string): string {
        return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private updateLinksInText(
        markdownText: string,
        activeFilePath: string,
        movedFileByOldPath: Map<string, TFile>,
    ): string {
        return markdownText.replace(/(!?\[\[)([^\]]+)(\]\])/g, (fullMatch, open, rawLink, close) => {
            const linkpath = this.extractLinkpath(rawLink);
            if (!linkpath) {
                return fullMatch;
            }

            const resolved = this.app.metadataCache.getFirstLinkpathDest(linkpath, activeFilePath);
            if (!(resolved instanceof TFile)) {
                return fullMatch;
            }

            const movedTarget = movedFileByOldPath.get(this.normalizePath(resolved.path));
            if (!movedTarget) {
                return fullMatch;
            }

            const replacementLinkpath = this.app.metadataCache.fileToLinktext(movedTarget, activeFilePath, true);
            const updatedRawLink = this.replaceLinkpathPreservingContext(rawLink, replacementLinkpath);
            return `${open}${updatedRawLink}${close}`;
        });
    }

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
        
        const parentFolder = file.parent;
        let existingFolderPath = parentFolder?.path;
        if (!this.settings.retainFolderStructure) {
            existingFolderPath = '';
        }

        const folderSuffix = `${file.basename} files`;
        const fileAlreadyInTargetFolder = parentFolder?.name === folderSuffix;
        const targetFolderName = this.settings.retainFolderStructure && fileAlreadyInTargetFolder
            ? parentFolder?.path ?? folderSuffix
            : existingFolderPath
                ? `${existingFolderPath}/${folderSuffix}`
                : folderSuffix;
		const folderExists = this.app.vault.getAbstractFileByPath(targetFolderName);
		if (!(folderExists instanceof TFolder) )
		{
			await this.app.vault.createFolder(targetFolderName).catch(() => {});
		}

        const originalMarkdownPath = this.normalizePath(file.path);
        const movedFileByOldPath = new Map<string, TFile>();

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

                movedFileByOldPath.set(this.normalizePath(sourcePath), fileItem);
                await this.app.vault.rename(fileItem, targetPath);
                new Notice(`Moved ${fileItem.name} to ${targetPath}`);
            } catch (error) {
                new Notice(`Failed to move file ${fileItem.name}: ${error}`);
                console.error(`Failed to move file ${fileItem.name}:`, error);
            }
        }

        const movedMarkdownFile = movedFileByOldPath.get(originalMarkdownPath) ?? file;
        const currentMarkdownText = await this.app.vault.read(movedMarkdownFile);
        const updatedMarkdownText = this.updateLinksInText(currentMarkdownText, movedMarkdownFile.path, movedFileByOldPath);

        if (updatedMarkdownText !== currentMarkdownText) {
            await this.app.vault.modify(movedMarkdownFile, updatedMarkdownText);
        }
    }

    async loadSettings() {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
            await this.saveData(this.settings);
    }
}
