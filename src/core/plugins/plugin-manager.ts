/**
 * PluginManager - Manages dynamic loading of orchestrator plugins
 */

import * as fs from "fs/promises";
import * as path from "path";
import { CustomPlugin, PluginContext } from "./interfaces.js";
import { log } from "../agents/logger.js";
import { HookRegistry } from "../../hooks/registry.js";
import { PATHS } from "../../shared/index.js";

export class PluginManager {
    private static instance: PluginManager;
    private plugins: Map<string, CustomPlugin> = new Map();
    private directory: string = "";
    private dynamicTools: Record<string, any> = {};

    private constructor() { }

    public static getInstance(): PluginManager {
        if (!PluginManager.instance) {
            PluginManager.instance = new PluginManager();
        }
        return PluginManager.instance;
    }

    public async initialize(directory: string): Promise<void> {
        this.directory = directory;
        await this.loadPlugins();
    }

    /**
     * Load plugins from .opencode/plugins/*.js
     */
    private async loadPlugins(): Promise<void> {
        if (!this.directory) return;

        const pluginsDir = path.join(this.directory, PATHS.PLUGINS);
        try {
            await fs.mkdir(pluginsDir, { recursive: true });
            const files = await fs.readdir(pluginsDir);

            for (const file of files) {
                if (file.endsWith(".js") || file.endsWith(".mjs")) {
                    await this.loadPlugin(path.join(pluginsDir, file));
                }
            }
        } catch (error) {
            log(`[PluginManager] Error reading plugins directory: ${error}`);
        }
    }

    private async loadPlugin(pluginPath: string): Promise<void> {
        try {
            // Use dynamic import for ES modules
            const module = await import(`file://${pluginPath}`);
            const plugin: CustomPlugin = module.default || module;

            if (!plugin.name) {
                log(`[PluginManager] Plugin at ${pluginPath} missing name, skipping.`);
                return;
            }

            log(`[PluginManager] Loading plugin: ${plugin.name} (v${plugin.version})`);

            // Initialize plugin
            const context: PluginContext = { directory: this.directory };
            if (plugin.init) {
                await plugin.init(context);
            }

            // Register Tools
            if (plugin.tools) {
                for (const [name, tool] of Object.entries(plugin.tools)) {
                    this.dynamicTools[name] = tool;
                    log(`[PluginManager] Registered tool: ${name} from plugin ${plugin.name}`);
                }
            }

            // Register Hooks
            if (plugin.hooks) {
                const registry = HookRegistry.getInstance();
                if (plugin.hooks.preTool) registry.registerPreTool(plugin.hooks.preTool);
                if (plugin.hooks.postTool) registry.registerPostTool(plugin.hooks.postTool);
                if (plugin.hooks.chat) registry.registerChat(plugin.hooks.chat);
                if (plugin.hooks.done) registry.registerDone(plugin.hooks.done);
                log(`[PluginManager] Registered hooks from plugin ${plugin.name}`);
            }

            this.plugins.set(plugin.name, plugin);
        } catch (error) {
            log(`[PluginManager] Failed to load plugin ${pluginPath}: ${error}`);
        }
    }

    /**
     * Get all dynamically registered tools
     */
    public getDynamicTools(): Record<string, any> {
        return this.dynamicTools;
    }

    /**
     * Shutdown - cleanup all plugins
     */
    public async shutdown(): Promise<void> {
        for (const [name, plugin] of this.plugins.entries()) {
            try {
                if (plugin.cleanup) {
                    await plugin.cleanup();
                }
                log(`[PluginManager] Cleaned up plugin: ${name}`);
            } catch (error) {
                log(`[PluginManager] Error cleaning up plugin ${name}: ${error}`);
            }
        }
        this.plugins.clear();
        this.dynamicTools = {};
    }
}
