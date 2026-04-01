const { Plugin, TFile, Modal, Setting, Notice } = require('obsidian');

module.exports = class BatchChapterRenamer extends Plugin {
    async onload() {
        this.registerEvent(
            this.app.workspace.on("files-menu", (menu, files) => {
                if (files.length > 0) {
                    menu.addItem((item) => {
                        item.setTitle("Batch Rename Chapters")
                            .setIcon("hash")
                            .onClick(() => {
                                new RenameModal(this.app, async (prefix, startNum) => {
                                    await this.batchRename(files, prefix, startNum);
                                }).open();
                            });
                    });
                }
            })
        );
    }

    async batchRename(files, prefix, startNum) {
        let currentNum = parseInt(startNum);
        const tFiles = files.filter(f => f instanceof TFile)
            .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));

        const tasks = [];

        // 1. 预计算所有目标新路径
        for (let i = 0; i < tFiles.length; i++) {
            const file = tFiles[i];
            const oldName = file.basename;
            const regex = /^(Ep\.|Ch\.|Chapter|Vol\.)\s?[\d\.]+\s*/i;
            const cleanTitle = oldName.replace(regex, "").trim();
            
            const newName = `${prefix} ${currentNum + i} ${cleanTitle}`;
            const newPath = `${file.parent.path}/${newName}.${file.extension}`;
            tasks.push({ file, newPath });
        }

        // 2. 第一遍处理：先全部重命名为临时文件名（避免冲突）
        // 使用时间戳和随机数确保唯一性
        for (const task of tasks) {
            const tempPath = `${task.file.parent.path}/_temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${task.file.extension}`;
            await this.app.fileManager.renameFile(task.file, tempPath);
        }

        // 3. 第二遍处理：从临时名改回最终的目标名
        let successCount = 0;
        for (const task of tasks) {
            try {
                await this.app.fileManager.renameFile(task.file, task.newPath);
                successCount++;
            } catch (err) {
                console.error(`Final rename failed`, err);
            }
        }
        
        new Notice(`Renamed ${successCount} files.`);
    }
}

class RenameModal extends Modal {
    constructor(app, onSubmit) {
        super(app);
        this.onSubmit = onSubmit;
        this.prefix = "Ep.";
        this.startNum = "1";
    }

    onOpen() {
        const { contentEl } = this;
        new Setting(contentEl)
            .setName("Prefix")
            .addText((text) => text.setValue(this.prefix).onChange((v) => this.prefix = v));

        new Setting(contentEl)
            .setName("Starting Number")
            .addText((text) => text.setValue(this.startNum).onChange((v) => this.startNum = v));

        new Setting(contentEl).addButton((btn) =>
            btn.setButtonText("Rename")
                .setCta()
                .onClick(() => {
                    const num = parseInt(this.startNum);
                    if (isNaN(num)) {
                        new Notice("Invalid number.");
                        return;
                    }
                    this.close();
                    this.onSubmit(this.prefix, this.startNum);
                })
        );
    }

    onClose() {
        this.contentEl.empty();
    }
}