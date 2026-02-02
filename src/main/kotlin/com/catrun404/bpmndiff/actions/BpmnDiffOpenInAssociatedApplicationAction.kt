package com.catrun404.bpmndiff.actions

import com.catrun404.bpmndiff.BpmnDiffBundle
import com.intellij.icons.AllIcons
import com.intellij.ide.actions.RevealFileAction
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.fileTypes.NativeFileType
import com.intellij.openapi.project.DumbAwareAction
import com.intellij.openapi.vfs.VirtualFile

import org.jetbrains.annotations.NotNull
import org.jetbrains.annotations.Nullable


class BpmnDiffOpenInAssociatedApplicationAction : DumbAwareAction(
    BpmnDiffBundle.messagePointer("action.open.file.text"),
    BpmnDiffBundle.messagePointer("action.open.file.description"),
    AllIcons.General.Inline_edit
) {
    override fun update(@NotNull e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = getFile(e) != null
    }

    override fun getActionUpdateThread(): ActionUpdateThread {
        return ActionUpdateThread.BGT
    }

    override fun actionPerformed(@NotNull e: AnActionEvent) {
        val file = getFile(e)
        if (file != null) {
            NativeFileType.openAssociatedApplication(file)
        }
    }

    @Nullable
    private fun getFile(e: AnActionEvent): VirtualFile? {
        return RevealFileAction.findLocalFile(e.getData(CommonDataKeys.VIRTUAL_FILE))
    }

}
