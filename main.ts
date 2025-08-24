import { FinshotsView } from 'FinshotsView';
import { App, Notice, Plugin, WorkspaceLeaf } from 'obsidian';

export interface FinshotsArticle {
    title: string;
    imageUrl: string;
    articleUrl: string;
    date: string;
    summary?: string;
}

export const FINSHOTS_VIEW_TYPE = "finshots-daily-view";

export default class FinshotsDailyPlugin extends Plugin {

    private refreshInterval: number | null = null;

    async onload() {

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
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                if(leaf.getViewState().active) {
                    await leaf.setViewState({ type: FINSHOTS_VIEW_TYPE, active: false });
                }
                await leaf.setViewState({ type: FINSHOTS_VIEW_TYPE, active: true });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    setupAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Calculate time until next refresh
        const now = new Date();
        const [hours, minutes] = [9, 0];

        const nextRefresh = new Date();
        nextRefresh.setHours(hours, minutes, 0, 0);
        
        if (nextRefresh <= now) {
            nextRefresh.setDate(nextRefresh.getDate() + 1);
        }

        const timeUntilRefresh = nextRefresh.getTime() - now.getTime();

        setTimeout(() => {
            this.refreshArticle();
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
   
}