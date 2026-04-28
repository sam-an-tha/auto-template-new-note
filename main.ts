import {
  App,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TAbstractFile,
  TFile,
  normalizePath,
} from "obsidian";

interface AutoTemplateSettings {
  templateFilePath: string;
}

const DEFAULT_SETTINGS: AutoTemplateSettings = {
  templateFilePath: "",
};

const NOTICE_DURATION_MS = 5000;
const AUTO_APPLY_DELAY_MS = 100;
const TEMPLATE_PATH_PLACEHOLDER = "Templates/Standard.md";
const CREATOR_URL = "https://ko-fi.com/heysam";

export default class AutoTemplateNewNotePlugin extends Plugin {
  settings: AutoTemplateSettings;

  async onload() {
    await this.loadSettings();

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        void this.handleCreatedFile(file);
      })
    );

    this.addCommand({
      id: "apply-configured-template-to-current-note",
      name: "Apply configured template to current note",
      callback: () => {
        void this.applyTemplateToActiveFile();
      },
    });

    this.addSettingTab(new AutoTemplateSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async handleCreatedFile(file: TAbstractFile) {
    if (!this.isMarkdownFile(file)) {
      return;
    }

    if (this.isConfiguredTemplateFile(file)) {
      return;
    }

    if (!this.settings.templateFilePath.trim()) {
      new Notice(
        "Auto-template needs a template path. Set one in plugin settings.",
        NOTICE_DURATION_MS
      );
      return;
    }

    await sleep(AUTO_APPLY_DELAY_MS);

    await this.applyTemplateToFile(file, {
      successNotice: false,
      emptyAbortNotice: false,
    });
  }

  private async applyTemplateToActiveFile() {
    const activeFile = this.app.workspace.getActiveFile();

    if (!this.isMarkdownFile(activeFile)) {
      new Notice(
        "Open a Markdown note before applying the configured template.",
        NOTICE_DURATION_MS
      );
      return;
    }

    if (this.isConfiguredTemplateFile(activeFile)) {
      new Notice(
        "The configured template file cannot be templated.",
        NOTICE_DURATION_MS
      );
      return;
    }

    await this.applyTemplateToFile(activeFile, {
      successNotice: true,
      emptyAbortNotice: true,
    });
  }

  private async applyTemplateToFile(
    targetFile: TFile,
    options: { successNotice: boolean; emptyAbortNotice: boolean }
  ) {
    const templateFile = this.getValidTemplateFile({ showNotice: true });

    if (!templateFile) {
      return;
    }

    let applied = false;

    try {
      const templateContent = await this.app.vault.read(templateFile);
      const renderedTemplate = renderTemplateContent(templateContent, targetFile);

      await this.app.vault.process(targetFile, (currentContent) => {
        if (currentContent.trim().length > 0) {
          return currentContent;
        }

        applied = true;
        return renderedTemplate;
      });
    } catch (error) {
      console.error("Auto-template failed to apply template", error);
      new Notice(
        "Auto-template could not apply the template. Check the developer console for details.",
        NOTICE_DURATION_MS
      );
      return;
    }

    if (applied && options.successNotice) {
      new Notice("Template applied!", NOTICE_DURATION_MS);
    }

    if (!applied && options.emptyAbortNotice) {
      new Notice(
        "Note is not empty. Template was not applied to prevent data loss.",
        NOTICE_DURATION_MS
      );
    }
  }

  getTemplatePath(): string {
    return normalizeTemplatePath(this.settings.templateFilePath);
  }

  getTemplateValidationMessage(): string {
    const templatePath = this.getTemplatePath();

    if (!templatePath) {
      return "No template configured. Enter a Markdown file path to enable auto-templating.";
    }

    const templateFile = this.app.vault.getAbstractFileByPath(templatePath);

    if (!templateFile) {
      return "Template file does not exist yet. The path is saved and will work once the file exists.";
    }

    if (!this.isMarkdownFile(templateFile)) {
      return "Template path must point to a Markdown file.";
    }

    return "Template path is valid.";
  }

  private getValidTemplateFile(options: { showNotice: boolean }): TFile | null {
    const templatePath = this.getTemplatePath();

    if (!templatePath) {
      if (options.showNotice) {
        new Notice(
          "Auto-template needs a template path. Set one in plugin settings.",
          NOTICE_DURATION_MS
        );
      }
      return null;
    }

    const templateFile = this.app.vault.getAbstractFileByPath(templatePath);

    if (!templateFile) {
      if (options.showNotice) {
        new Notice(
          "Template file not found. Check the path in auto-template settings.",
          NOTICE_DURATION_MS
        );
      }
      return null;
    }

    if (!this.isMarkdownFile(templateFile)) {
      if (options.showNotice) {
        new Notice(
          "Template path must point to a Markdown file.",
          NOTICE_DURATION_MS
        );
      }
      return null;
    }

    return templateFile;
  }

  private isMarkdownFile(file: TAbstractFile | null): file is TFile {
    return file instanceof TFile && file.extension.toLowerCase() === "md";
  }

  private isConfiguredTemplateFile(file: TFile): boolean {
    const templatePath = this.getTemplatePath();
    return Boolean(templatePath) && file.path === templatePath;
  }
}

class AutoTemplateSettingTab extends PluginSettingTab {
  plugin: AutoTemplateNewNotePlugin;

  constructor(app: App, plugin: AutoTemplateNewNotePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    new Setting(containerEl).setName("Template").setHeading();

    const validation = containerEl.createEl("p", {
      text: this.plugin.getTemplateValidationMessage(),
    });

    new Setting(containerEl)
      .setName("Template file path")
      .setDesc(
        "Vault-relative path to the Markdown file that should be copied into new empty notes."
      )
      .addText((text) =>
        text
          .setPlaceholder(TEMPLATE_PATH_PLACEHOLDER)
          .setValue(this.plugin.settings.templateFilePath)
          .onChange(async (value) => {
            this.plugin.settings.templateFilePath = value;
            await this.plugin.saveSettings();
            validation.setText(this.plugin.getTemplateValidationMessage());
          })
      );

    const creator = containerEl.createEl("p");
    creator.appendText("Creator: ");
    creator.createEl("a", {
      // eslint-disable-next-line obsidianmd/ui/sentence-case
      text: "Samantha Leck",
      attr: {
        href: CREATOR_URL,
        target: "_blank",
        rel: "noopener noreferrer",
      },
    });
  }
}

function normalizeTemplatePath(path: string): string {
  const trimmedPath = path.trim();
  return trimmedPath ? normalizePath(trimmedPath) : "";
}

function renderTemplateContent(templateContent: string, targetFile: TFile): string {
  const now = new Date();

  return templateContent
    .replace(/\{\{\s*date(?:\s*:\s*YYYY-MM-DD)?\s*\}\}/g, formatDate(now))
    .replace(/\{\{\s*time(?:\s*:\s*HH:mm)?\s*\}\}/g, formatTime(now))
    .replace(/\{\{\s*title\s*\}\}/g, targetFile.basename);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
