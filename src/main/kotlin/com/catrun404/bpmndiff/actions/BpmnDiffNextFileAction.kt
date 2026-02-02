package com.catrun404.bpmndiff.actions

import com.catrun404.bpmndiff.BpmnDiffBundle
import com.catrun404.bpmndiff.toolWindow.BpmnDiffToolWindow
import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.DumbAwareAction

class BpmnDiffNextFileAction : DumbAwareAction(
    BpmnDiffBundle.messagePointer("action.next.file.text"),
    BpmnDiffBundle.messagePointer("action.next.file.description"),
    AllIcons.Actions.Forward
) {
    override fun actionPerformed(e: AnActionEvent) {
        e.getData(BpmnDiffToolWindow.DATA_KEY)?.selectNextFile()
    }

    override fun update(e: AnActionEvent) {
        val toolWindow = e.getData(BpmnDiffToolWindow.DATA_KEY)
        e.presentation.isEnabled = toolWindow?.canNavigateFiles() == true
        e.presentation.isVisible = toolWindow?.isGitModeActive() == true
    }

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.EDT
}
