import { App, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, ItemView } from 'obsidian';

interface FinshotsPluginSettings {
    refreshTime: string;
    autoRefresh: boolean;
    useAPI: boolean;
    apiEndpoint: string;
}

const DEFAULT_SETTINGS: FinshotsPluginSettings = {
    refreshTime: '09:00',
    autoRefresh: true,
    useAPI: false,
    apiEndpoint: ''
};

interface FinshotsArticle {
    title: string;
    imageUrl: string;
    articleUrl: string;
    date: string;
    summary?: string;
}

export const FINSHOTS_VIEW_TYPE = "finshots-daily-view";

export class FinshotsView extends ItemView {
    plugin: FinshotsDailyPlugin;
    private article: FinshotsArticle | null = null;
    private isLoading = false;

    constructor(leaf: WorkspaceLeaf, plugin: FinshotsDailyPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return FINSHOTS_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Finshots Daily";
    }

    getIcon(): string {
        return "newspaper";
    }

    async onOpen() {
        await this.render();
        await this.loadArticle();
    }

    async onClose() {
    }

    private async render() {
        const container = this.containerEl.children[1];
        container.empty();
        
        const headerEl = container.createEl("div", { cls: "finshots-header" });
        headerEl.createEl("h2", { text: "Finshots Daily" });
        
         const refreshBtn = headerEl.createEl("button", { 
             text: "Refresh", 
             cls: "finshots-refresh-btn" 
            });
         refreshBtn.addEventListener("click", () => this.loadArticle());

        const contentEl = container.createEl("div", { cls: "finshots-content" });
        
        this.renderContent(contentEl);
        this.addStyles();
    }

    private renderContent(contentEl: HTMLElement) {
        contentEl.empty();
        
        if (this.isLoading) {
            contentEl.createEl("div", { 
                text: "Loading today's article...", 
                cls: "finshots-loading" 
            });
            return;
        }

        if (!this.article) {
            const errorEl = contentEl.createEl("div", { cls: "finshots-error" });
            errorEl.createEl("p", { text: "No article found for today." });
            errorEl.createEl("p", { text: "Click refresh to try again." });
            return;
        }

        // Article container
        const articleEl = contentEl.createEl("div", { cls: "finshots-article" });
        
        // Date
        articleEl.createEl("div", { 
            text: this.article.date, 
            cls: "finshots-date" 
        });
        
        // Image
        if (this.article.imageUrl) {
            const imageEl = articleEl.createEl("img", { 
                cls: "finshots-image" 
            });
            imageEl.src = this.article.imageUrl;
            imageEl.alt = this.article.title;
        }
        
        // Title
        const titleEl = articleEl.createEl("h3", { 
            text: this.article.title, 
            cls: "finshots-title" 
        });
        
        // Summary if available
        if (this.article.summary) {
            articleEl.createEl("p", { 
                text: this.article.summary, 
                cls: "finshots-summary" 
            });
        }
        
        // Read more button
        const readMoreEl = articleEl.createEl("a", { 
            text: "Read Full Article", 
            cls: "finshots-read-more" 
        });
        readMoreEl.href = this.article.articleUrl;
        readMoreEl.target = "_blank";
    }

    private addStyles() {
        const styleEl = document.createElement("style");
        styleEl.textContent = `
            .finshots-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px;
                border-bottom: 1px solid var(--background-modifier-border);
                margin-bottom: 10px;
            }
            
            .finshots-refresh-btn {
                padding: 5px 10px;
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border: none;
                border-radius: 3px;
                cursor: pointer;
            }
            
            .finshots-content {
                padding: 10px;
            }
            
            .finshots-loading, .finshots-error {
                text-align: center;
                padding: 20px;
                color: var(--text-muted);
            }
            
            .finshots-article {
                border: 1px solid var(--background-modifier-border);
                border-radius: 5px;
                padding: 15px;
                background: var(--background-secondary);
            }
            
            .finshots-date {
                font-size: 0.8em;
                color: var(--text-muted);
                margin-bottom: 10px;
            }
            
            .finshots-image {
                width: 100%;
                max-height: 200px;
                object-fit: cover;
                border-radius: 3px;
                margin-bottom: 10px;
            }
            
            .finshots-title {
                margin: 0 0 10px 0;
                color: var(--text-normal);
                line-height: 1.3;
            }
            
            .finshots-summary {
                color: var(--text-muted);
                line-height: 1.4;
                margin-bottom: 15px;
            }
            
            .finshots-read-more {
                display: inline-block;
                padding: 8px 15px;
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                text-decoration: none;
                border-radius: 3px;
                font-size: 0.9em;
            }
            
            .finshots-read-more:hover {
                background: var(--interactive-accent-hover);
            }
        `;
        document.head.appendChild(styleEl);
    }

    async loadArticle() {
        this.isLoading = true;
        const contentEl = this.containerEl.querySelector('.finshots-content') as HTMLElement;
        if (contentEl) {
            this.renderContent(contentEl);
        }

        try {
                this.article = await this.scrapeWebsite();
        } catch (error) {
            console.error('Failed to load Finshots article:', error);
            new Notice('Failed to load Finshots article');
            this.article = null;
        } finally {
            this.isLoading = false;
            if (contentEl) {
                this.renderContent(contentEl);
            }
        }
    }

    private async scrapeWebsite(): Promise<FinshotsArticle | null> {
        try {
            const proxyUrl = 'https://api.allorigins.win/get?url=';
            const targetUrl = encodeURIComponent('https://finshots.in/archive/');
            
            const response = await fetch(proxyUrl + targetUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Debug: Check what we're getting from the proxy
            console.log('Proxy response data:', data);
            
            // Check if we have the expected structure
            if (!data || !data.contents) {
                throw new Error('Invalid response structure from proxy');
            }
            
            const html = data.contents;
            
            // Debug: Check HTML length and first few characters
            console.log('HTML length:', html.length);
            console.log('HTML preview:', html.substring(0, 500));
            
            // Write HTML to file for debugging
            //await this.writeHtmlToVault(html);

            // Parse HTML using DOMParser
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Debug: Check if parsing worked
            console.log('Parsed document:', doc);
            console.log('Document title:', doc.title);
            
            // Try multiple selectors to find articles
            const selectors = [
                '.post-feed article.post-card',
                'article.post-card',
                '.post-card',
                'article',
                '.post'
            ];
            
            let firstArticle = null;
            let usedSelector = '';
            
            for (const selector of selectors) {
                firstArticle = doc.querySelector(selector);
                if (firstArticle) {
                    usedSelector = selector;
                    console.log(`Found article using selector: ${selector}`);
                    break;
                }
            }
            
            if (!firstArticle) {
                // Debug: Log available elements
                const allElements = doc.querySelectorAll('*');
                console.log('Total elements found:', allElements.length);
                
                const articleElements = doc.querySelectorAll('[class*="post"], [class*="article"], [class*="card"]');
                console.log('Potential article elements:', articleElements.length);
                
                articleElements.forEach((el, index) => {
                    console.log(`Element ${index}:`, el.className, el.tagName);
                });
                
                throw new Error('Could not find any article in the post feed');
            }
            
            console.log('Article element:', firstArticle);
            console.log('Article HTML:', firstArticle.outerHTML.substring(0, 500));
            
            // Extract title with multiple fallbacks
            const titleSelectors = [
                '.post-card-title',
                '.post-title',
                'h2',
                'h3',
                '[class*="title"]'
            ];
            
            let titleElement = null;
            let title = '';
            
            for (const selector of titleSelectors) {
                titleElement = firstArticle.querySelector(selector);
                if (titleElement) {
                    title = titleElement.textContent?.trim() || '';
                    if (title) {
                        console.log(`Found title using selector: ${selector}`);
                        break;
                    }
                }
            }
            
            if (!title) {
                title = 'Latest Finshots Article';
                console.log('Using fallback title');
            }
            
            // Extract image URL with multiple fallbacks
            const imageSelectors = [
                '.post-card-image',
                'img',
                '[class*="image"]'
            ];
            
            let imageElement = null;
            let imageUrl = '';
            
            for (const selector of imageSelectors) {
                imageElement = firstArticle.querySelector(selector);
                if (imageElement) {
                    imageUrl = imageElement.getAttribute('src') || '';
                    if (!imageUrl) {
                        const srcset = imageElement.getAttribute('srcset');
                        if (srcset) {
                            const srcsetUrls = srcset.split(',');
                            const lastUrl = srcsetUrls[srcsetUrls.length - 1];
                            imageUrl = lastUrl.split(' ')[0].trim();
                        }
                    }
                    if (imageUrl) {
                        console.log(`Found image using selector: ${selector}`);
                        break;
                    }
                }
            }
            
            // Extract article URL with multiple fallbacks
            const linkSelectors = [
                '.post-card-content-link',
                'a[href*="/archive/"]',
                'a',
                '[href]'
            ];
            
            let linkElement = null;
            let articleUrl = '';
            
            for (const selector of linkSelectors) {
                linkElement = firstArticle.querySelector(selector);
                if (linkElement) {
                    articleUrl = linkElement.getAttribute('href') || '';
                    if (articleUrl && articleUrl !== '#') {
                        console.log(`Found link using selector: ${selector}`);
                        break;
                    }
                }
            }
            
            // Convert relative URL to absolute URL
            if (articleUrl && !articleUrl.startsWith('http')) {
                articleUrl = `https://finshots.in${articleUrl}`;
            }
            
            // Extract date with multiple fallbacks
            const dateSelectors = [
                '.post-card-meta-date',
                'time',
                '[datetime]',
                '[class*="date"]'
            ];
            
            let dateElement = null;
            let dateString = '';
            let formattedDate = new Date().toLocaleDateString();
            
            for (const selector of dateSelectors) {
                dateElement = firstArticle.querySelector(selector);
                if (dateElement) {
                    dateString = dateElement.getAttribute('datetime') || dateElement.textContent?.trim() || '';
                    if (dateString) {
                        console.log(`Found date using selector: ${selector}`);
                        break;
                    }
                }
            }
            
            if (dateString) {
                try {
                    const articleDate = new Date(dateString);
                    if (!isNaN(articleDate.getTime())) {
                        formattedDate = articleDate.toLocaleDateString();
                    }
                } catch (error) {
                    console.warn('Failed to parse date:', dateString);
                }
            }
            
            // Extract excerpt/summary with multiple fallbacks
            const excerptSelectors = [
                '.post-card-excerpt',
                '.excerpt',
                'p',
                '[class*="summary"]'
            ];
            
            let excerptElement = null;
            let summary = '';
            
            for (const selector of excerptSelectors) {
                excerptElement = firstArticle.querySelector(selector);
                if (excerptElement) {
                    summary = excerptElement.textContent?.trim() || '';
                    if (summary && summary.length > 20) { // Ensure it's not just a short text
                        console.log(`Found summary using selector: ${selector}`);
                        break;
                    }
                }
            }
            
            // Extract category/tag with multiple fallbacks
            const tagSelectors = [
                '.post-card-primary-tag',
                '.tag',
                '[class*="tag"]',
                '[class*="category"]'
            ];
            
            let tagElement = null;
            let category = '';
            
            for (const selector of tagSelectors) {
                tagElement = firstArticle.querySelector(selector);
                if (tagElement) {
                    category = tagElement.textContent?.trim() || '';
                    if (category) {
                        console.log(`Found category using selector: ${selector}`);
                        break;
                    }
                }
            }
            
            // Ensure image URL is absolute
            if (imageUrl && !imageUrl.startsWith('http')) {
                imageUrl = `https://finshots.in${imageUrl}`;
            }
            
            // Log extracted data for debugging
            const extractedData = {
                title,
                imageUrl,
                articleUrl,
                date: formattedDate,
                summary,
                category,
                usedSelector
            };
            
            console.log('Extracted article data:', extractedData);
            
            new Notice(`Found article: ${title}`);
            
            return {
                title,
                imageUrl,
                articleUrl,
                date: formattedDate,
                summary: summary ? `${category ? `[${category}] ` : ''}${summary}` : undefined
            };
            
        } catch (error) {
            console.error('Web scraping failed:', error);
            new Notice('Failed to scrape Finshots website: ' + error.message);
            
            // Return a fallback article
            return {
                title: 'Failed to fetch the latest article from Finshots Daily',
                imageUrl: '',
                articleUrl: 'https://finshots.in/',
                date: new Date().toLocaleDateString(),
                summary: 'Please check the Finshots website directly or try refreshing.'
            };
        }
    }

    // Add this helper method to write HTML to vault for debugging
    // private async writeHtmlToVault(html: string): Promise<void> {
    //     try {
    //         const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    //         const filename = `finshots-debug-${timestamp}.txt`;
            
    //         // Write to vault root
    //         await this.app.vault.create(filename, html);
            
    //         console.log(`HTML content saved to vault file: ${filename}`);
    //         new Notice(`Debug HTML saved to: ${filename}`);
            
    //     } catch (error) {
    //         console.error('Failed to write HTML to vault:', error);
            
    //         // Fallback: try to create in a debug folder
    //         try {
    //             const debugFolder = 'Debug';
    //             if (!await this.app.vault.adapter.exists(debugFolder)) {
    //                 await this.app.vault.createFolder(debugFolder);
    //             }
                
    //             const filepath = `${debugFolder}/${filename}`;
    //             await this.app.vault.create(filepath, html);
    //             console.log(`HTML saved to: ${filepath}`);
    //             new Notice(`Debug HTML saved to: ${filepath}`);
    //         } catch (fallbackError) {
    //             console.error('Fallback write also failed:', fallbackError);
    //         }
    //     }
    // }
}

export default class FinshotsDailyPlugin extends Plugin {
    settings: FinshotsPluginSettings;

    private refreshInterval: number | null = null;

    async onload() {
        await this.loadSettings();

        // Register the view
        this.registerView(
            FINSHOTS_VIEW_TYPE,
            (leaf) => new FinshotsView(leaf, this)
        );

        // Add ribbon icon
        this.addRibbonIcon('newspaper', 'Open Finshots Daily', () => {
            this.activateView();
        });

        // Add command
        this.addCommand({
            id: 'open-finshots-daily',
            name: 'Open Finshots Daily',
            callback: () => {
                this.activateView();
            },
        });

        // Add settings tab
        this.addSettingTab(new FinshotsSettingTab(this.app, this));

        // Set up auto-refresh
        this.setupAutoRefresh();
    }

    onunload() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(FINSHOTS_VIEW_TYPE);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Our view could not be found in the workspace, create a new leaf
            // in the right sidebar for it
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                if(leaf.getViewState().active) {
                    await leaf.setViewState({ type: FINSHOTS_VIEW_TYPE, active: false });
                }
                await leaf.setViewState({ type: FINSHOTS_VIEW_TYPE, active: true });
            }
        }

        // "Reveal" the leaf in case it is in a collapsed sidebar
        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    setupAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        if (!this.settings.autoRefresh) {
            return;
        }

        // Calculate time until next refresh
        const now = new Date();
        const [hours, minutes] = this.settings.refreshTime.split(':').map(Number);
        
        const nextRefresh = new Date();
        nextRefresh.setHours(hours, minutes, 0, 0);
        
        // If the time has already passed today, schedule for tomorrow
        if (nextRefresh <= now) {
            nextRefresh.setDate(nextRefresh.getDate() + 1);
        }

        const timeUntilRefresh = nextRefresh.getTime() - now.getTime();

        // Set initial timeout
        setTimeout(() => {
            this.refreshArticle();
            // Then set up daily interval
            this.refreshInterval = window.setInterval(() => {
                this.refreshArticle();
            }, 24 * 60 * 60 * 1000); // 24 hours
        }, timeUntilRefresh);
    }

    async refreshArticle() {
        const leaves = this.app.workspace.getLeavesOfType(FINSHOTS_VIEW_TYPE);
        for (const leaf of leaves) {
            if (leaf.view instanceof FinshotsView) {
                await leaf.view.loadArticle();
            }
        }
        new Notice('Finshots Daily article refreshed');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.setupAutoRefresh(); // Restart auto-refresh with new settings
    }
}

class FinshotsSettingTab extends PluginSettingTab {
    plugin: FinshotsDailyPlugin;

    constructor(app: App, plugin: FinshotsDailyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Finshots Daily Settings' });

        new Setting(containerEl)
            .setName('Auto-refresh')
            .setDesc('Automatically refresh the article daily')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoRefresh)
                .onChange(async (value) => {
                    this.plugin.settings.autoRefresh = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Refresh time')
            .setDesc('Time to refresh the article (24-hour format, e.g., 09:00)')
            .addText(text => text
                .setPlaceholder('09:00')
                .setValue(this.plugin.settings.refreshTime)
                .onChange(async (value) => {
                    // Validate time format
                    if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
                        this.plugin.settings.refreshTime = value;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Use API')
            .setDesc('Use API endpoint instead of web scraping (when available)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useAPI)
                .onChange(async (value) => {
                    this.plugin.settings.useAPI = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('API Endpoint')
            .setDesc('API endpoint URL for fetching articles')
            .addText(text => text
                .setPlaceholder('https://api.finshots.com/daily')
                .setValue(this.plugin.settings.apiEndpoint)
                .onChange(async (value) => {
                    this.plugin.settings.apiEndpoint = value;
                    await this.plugin.saveSettings();
                }));
    }
}
